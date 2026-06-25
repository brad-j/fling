import { Client } from 'ssh2'
import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { getSettings, readPrivateKey, getHostKey, setHostKey } from './settings'

export interface SshResult {
  remotePath: string
}

/**
 * Reads ~/.ssh/known_hosts and returns the host key for the given host, if present.
 */
function readKnownHosts(host: string): string | undefined {
  const knownHostsPath = join(homedir(), '.ssh', 'known_hosts')
  try {
    const content = readFileSync(knownHostsPath, 'utf8')
    for (const line of content.split('\n')) {
      const parts = line.trim().split(/\s+/)
      if (parts.length < 3) continue
      const hosts = parts[0]
      const keyType = parts[1]
      const keyData = parts[2]
      // known_hosts can have comma-separated hostnames or hashed entries
      if (hosts.split(',').includes(host) || hosts.split(',').includes(`[${host}]:22`)) {
        return `${keyType} ${keyData}`
      }
    }
  } catch {
    // known_hosts doesn't exist or isn't readable
  }
  return undefined
}

export async function flingFile(
  localPath: string,
  remoteFilename: string
): Promise<SshResult> {
  const settings = getSettings()
  const privateKey = readPrivateKey(settings.keyPath)

  return new Promise((resolve, reject) => {
    const conn = new Client()

    const remotePath = `${settings.remotePath.replace(/\/$/, '')}/${remoteFilename}`

    conn.on('ready', () => {
      // Ensure remote directory exists, then upload
      conn.exec(`mkdir -p ${settings.remotePath}`, (err, stream) => {
        if (err) {
          conn.end()
          reject(err)
          return
        }
        stream.on('close', () => {
          // Upload the file via SFTP
          conn.sftp((err, sftp) => {
            if (err) {
              conn.end()
              reject(err)
              return
            }
            sftp.fastPut(localPath, remotePath, (err) => {
              conn.end()
              if (err) {
                reject(err)
              } else {
                resolve({ remotePath })
              }
            })
          })
        })
      })
    })

    conn.on('error', (err) => {
      reject(err)
    })

    // Host key verification (TOFU)
    const knownKey = getHostKey(settings.host) || readKnownHosts(settings.host)

    conn.connect({
      host: settings.host,
      port: settings.port,
      username: settings.username,
      privateKey,
      hostVerifier: (key: Buffer) => {
        if (knownKey) {
          // Compare the presented key with the known key
          // ssh2 gives us the key as a Buffer; we compare hex
          const presentedHex = key.toString('hex')
          // known_hosts key is base64 encoded
          const knownParts = knownKey.split(' ')
          if (knownParts.length >= 2) {
            const knownBuf = Buffer.from(knownParts[1], 'base64')
            if (knownBuf.toString('hex') === presentedHex) {
              return true
            }
            // Key mismatch — potential MITM
            return false
          }
        }
        // No known key — trust on first use
        setHostKey(settings.host, key.toString('base64'))
        return true
      }
    })
  })
}
