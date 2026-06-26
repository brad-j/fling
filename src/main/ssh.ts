import { Client } from 'ssh2'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { homedir, tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { getSettings, readPrivateKey, getHostKey, setHostKey } from './settings'
import { expandRemoteDir, joinRemotePath, shellQuote, stripTrailingSlash } from './remotePath'
import type { ConnectionTestCheck, ConnectionTestResult, FlingSettings } from './types'

export interface SshResult {
  remotePath: string
}

/**
 * Reads ~/.ssh/known_hosts and returns the host key for the given host, if present.
 */
function readKnownHosts(host: string, port: number): string | undefined {
  const knownHostsPath = join(homedir(), '.ssh', 'known_hosts')
  try {
    const content = readFileSync(knownHostsPath, 'utf8')
    for (const line of content.split('\n')) {
      const parts = line.trim().split(/\s+/)
      if (parts.length < 3) continue
      const hosts = parts[0]
      const keyData = parts[2]
      const hostEntries = hosts.split(',')

      // known_hosts can have comma-separated hostnames or hashed entries.
      // Hashed entries are intentionally not decoded here; TOFU storage below
      // still protects future connections made by Fling.
      if (hostEntries.includes(host) || hostEntries.includes(`[${host}]:${port}`)) {
        return keyData
      }
    }
  } catch {
    // known_hosts doesn't exist or isn't readable
  }
  return undefined
}

function runCommand(conn: Client, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) {
        reject(err)
        return
      }

      let stdout = ''
      let stderr = ''
      stream.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8')
      })
      stream.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8')
      })
      stream.on('close', (code: number | null) => {
        if (code && code !== 0) {
          reject(new Error(stderr.trim() || `Remote command failed with exit code ${code}`))
          return
        }
        resolve(stdout)
      })
    })
  })
}

function fastPut(conn: Client, localPath: string, remotePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) {
        reject(err)
        return
      }

      sftp.fastPut(localPath, remotePath, (putErr) => {
        if (putErr) {
          reject(putErr)
          return
        }
        resolve()
      })
    })
  })
}

function assertConnectionSettings(settings: FlingSettings): void {
  const missing: string[] = []
  if (!settings.host.trim()) missing.push('host')
  if (!settings.username.trim()) missing.push('username')
  if (!settings.remotePath.trim()) missing.push('remote path')
  if (!settings.keyPath.trim()) missing.push('SSH key path')

  if (missing.length > 0) {
    throw new Error(`Missing required connection settings: ${missing.join(', ')}`)
  }
}

function friendlyConnectionError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err)
  const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code?: unknown }).code) : ''
  const lower = message.toLowerCase()

  if (code === 'ENOENT') return 'SSH key file was not found. Check the key path.'
  if (code === 'EACCES') return 'SSH key file could not be read. Check file permissions.'
  if (code === 'ENOTFOUND' || lower.includes('getaddrinfo')) return 'Host could not be resolved. Check the host name.'
  if (code === 'ECONNREFUSED') return 'Connection was refused. Check the host and SSH port.'
  if (code === 'ETIMEDOUT' || lower.includes('timed out')) return 'Connection timed out. Check network access, VPN/Tailscale, host, and port.'
  if (lower.includes('authentication')) return 'Authentication failed. Check username, SSH key, and authorized_keys on the server.'
  if (lower.includes('host denied') || lower.includes('host key')) return 'Host key verification failed. The server identity may have changed.'
  if (lower.includes('permission denied')) return 'Permission denied. Check SSH authentication and remote directory permissions.'
  if (lower.includes('no such file')) return 'A required path was not found. Check the SSH key path and remote directory.'

  return message
}

function connect(settings: FlingSettings): Promise<Client> {
  assertConnectionSettings(settings)

  const privateKey = readPrivateKey(settings.keyPath)
  const hostKeyId = `${settings.host}:${settings.port}`
  const knownKey = getHostKey(hostKeyId) || getHostKey(settings.host) || readKnownHosts(settings.host, settings.port)
  const conn = new Client()

  return new Promise((resolve, reject) => {
    let settled = false

    const finish = (err?: Error) => {
      if (settled) return
      settled = true
      if (err) {
        conn.end()
        reject(err)
      } else {
        resolve(conn)
      }
    }

    conn.on('ready', () => finish())
    conn.on('error', (err) => finish(err))

    conn.connect({
      host: settings.host,
      port: settings.port,
      username: settings.username,
      privateKey,
      readyTimeout: 15000,
      hostVerifier: (key: Buffer) => {
        const presentedKey = key.toString('base64')
        if (knownKey) {
          return knownKey.trim() === presentedKey
        }

        // No known key — trust on first use.
        setHostKey(hostKeyId, presentedKey)
        return true
      }
    })
  })
}

export async function flingFile(
  localPath: string,
  remoteFilename: string
): Promise<SshResult> {
  const settings = getSettings()
  const conn = await connect(settings)

  try {
    const homeDir = stripTrailingSlash((await runCommand(conn, 'printf %s "$HOME"')).trim())
    const remoteDir = expandRemoteDir(settings.remotePath, homeDir || '.')
    const remotePath = joinRemotePath(remoteDir, remoteFilename)

    await runCommand(conn, `mkdir -p -- ${shellQuote(remoteDir)}`)
    await fastPut(conn, localPath, remotePath)
    return { remotePath }
  } finally {
    conn.end()
  }
}

export async function testConnection(settings: FlingSettings = getSettings()): Promise<ConnectionTestResult> {
  const checks: ConnectionTestCheck[] = [
    { id: 'settings', label: 'Required settings present', status: 'pending' },
    { id: 'ssh', label: 'SSH authentication', status: 'pending' },
    { id: 'remote-dir', label: 'Remote directory writable', status: 'pending' },
    { id: 'upload', label: 'Test upload and cleanup', status: 'pending' }
  ]

  const mark = (id: string, status: ConnectionTestCheck['status'], message?: string) => {
    const check = checks.find((item) => item.id === id)
    if (check) {
      check.status = status
      check.message = message
    }
  }

  let conn: Client | null = null
  let tempDir = ''

  try {
    assertConnectionSettings(settings)
    mark('settings', 'success')

    tempDir = mkdtempSync(join(tmpdir(), 'filefling-test-'))
    const testFilename = `.filefling-test-${Date.now()}-${randomUUID()}.txt`
    const localTestPath = join(tempDir, testFilename)
    writeFileSync(localTestPath, 'FileFling connection test\n')

    conn = await connect(settings)
    mark('ssh', 'success', `Connected as ${settings.username}@${settings.host}`)

    const homeDir = stripTrailingSlash((await runCommand(conn, 'printf %s "$HOME"')).trim())
    const remoteDir = expandRemoteDir(settings.remotePath, homeDir || '.')
    const remotePath = joinRemotePath(remoteDir, testFilename)

    await runCommand(conn, `mkdir -p -- ${shellQuote(remoteDir)}`)
    await runCommand(conn, `test -d ${shellQuote(remoteDir)} && test -w ${shellQuote(remoteDir)}`)
    mark('remote-dir', 'success', remoteDir)

    await fastPut(conn, localTestPath, remotePath)
    await runCommand(conn, `rm -f -- ${shellQuote(remotePath)}`)
    mark('upload', 'success', remotePath)

    return {
      ok: true,
      message: `Connected to ${settings.host}. Test upload succeeded.`,
      remotePath,
      checks
    }
  } catch (err) {
    const message = friendlyConnectionError(err)
    const firstPending = checks.find((check) => check.status === 'pending')
    if (firstPending) {
      firstPending.status = 'error'
      firstPending.message = message
    }

    return {
      ok: false,
      message,
      checks
    }
  } finally {
    conn?.end()
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  }
}
