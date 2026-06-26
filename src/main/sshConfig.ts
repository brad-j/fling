import { existsSync, readFileSync, readdirSync, statSync } from 'fs'
import { homedir } from 'os'
import { dirname, isAbsolute, join, resolve } from 'path'
import type { SshConfigHost } from './types'

interface HostBlock {
  aliases: string[]
  values: Partial<Omit<SshConfigHost, 'alias' | 'sourcePath' | 'warnings'>>
  sourcePath?: string
  warnings: string[]
}

const SUPPORTED_DIRECTIVES = new Set(['hostname', 'user', 'port', 'identityfile'])
const MAX_INCLUDE_DEPTH = 5

function stripInlineComment(line: string): string {
  let quote: string | null = null
  let escaped = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if ((char === '"' || char === "'") && !quote) {
      quote = char
      continue
    }

    if (char === quote) {
      quote = null
      continue
    }

    if (char === '#' && !quote) {
      return line.slice(0, i)
    }
  }

  return line
}

function tokenize(line: string): string[] {
  const tokens: string[] = []
  let token = ''
  let quote: string | null = null
  let escaped = false

  for (const char of line) {
    if (escaped) {
      token += char
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = true
      continue
    }

    if ((char === '"' || char === "'") && !quote) {
      quote = char
      continue
    }

    if (char === quote) {
      quote = null
      continue
    }

    if (/\s/.test(char) && !quote) {
      if (token) {
        tokens.push(token)
        token = ''
      }
      continue
    }

    token += char
  }

  if (token) tokens.push(token)
  return tokens
}

function expandLocalPath(path: string, baseDir: string): string {
  const expandedHome = path === '~' ? homedir() : path.startsWith('~/') ? join(homedir(), path.slice(2)) : path
  return isAbsolute(expandedHome) ? expandedHome : resolve(baseDir, expandedHome)
}

function hasGlobMagic(value: string): boolean {
  return /[*?[]/.test(value)
}

function expandIncludePattern(pattern: string, baseDir: string): string[] {
  const expanded = expandLocalPath(pattern, baseDir)

  if (!hasGlobMagic(expanded)) {
    return existsSync(expanded) ? [expanded] : []
  }

  const directory = dirname(expanded)
  const basenamePattern = expanded.slice(directory.length + 1)
  const regex = new RegExp(`^${basenamePattern
    .replace(/[.+^${}()|\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')}$`)

  try {
    return readdirSync(directory)
      .filter((entry) => regex.test(entry))
      .map((entry) => join(directory, entry))
      .filter((entryPath) => statSync(entryPath).isFile())
      .sort()
  } catch {
    return []
  }
}

function isConcreteHostAlias(alias: string): boolean {
  return Boolean(alias) && !alias.startsWith('!') && !/[?*]/.test(alias)
}

function readConfigFiles(path: string, seen = new Set<string>(), depth = 0): Array<{ path: string; content: string }> {
  if (seen.has(path) || depth > MAX_INCLUDE_DEPTH) return []
  seen.add(path)

  let content: string
  try {
    content = readFileSync(path, 'utf8')
  } catch {
    return []
  }

  const files: Array<{ path: string; content: string }> = [{ path, content }]
  const baseDir = dirname(path)

  for (const rawLine of content.split('\n')) {
    const tokens = tokenize(stripInlineComment(rawLine).trim())
    if (tokens.length === 0 || tokens[0].toLowerCase() !== 'include') continue

    for (const pattern of tokens.slice(1)) {
      for (const includePath of expandIncludePattern(pattern, baseDir)) {
        files.push(...readConfigFiles(includePath, seen, depth + 1))
      }
    }
  }

  return files
}

export function parseSshConfig(content: string, sourcePath?: string): SshConfigHost[] {
  const blocks: HostBlock[] = []
  let current: HostBlock | null = null

  for (const rawLine of content.split('\n')) {
    const line = stripInlineComment(rawLine).trim()
    if (!line) continue

    const tokens = tokenize(line)
    if (tokens.length === 0) continue

    const keyword = tokens[0].toLowerCase()
    const values = tokens.slice(1)

    if (keyword === 'host') {
      current = {
        aliases: values,
        values: {},
        sourcePath,
        warnings: []
      }
      blocks.push(current)
      continue
    }

    if (!current || keyword === 'match' || keyword === 'include') continue

    if (!SUPPORTED_DIRECTIVES.has(keyword)) continue
    if (values.length === 0) continue

    const value = values.join(' ')
    switch (keyword) {
      case 'hostname':
        current.values.hostName ??= value
        break
      case 'user':
        current.values.user ??= value
        break
      case 'port': {
        const port = Number(value)
        if (Number.isInteger(port) && port > 0 && port <= 65535) {
          current.values.port ??= port
        } else {
          current.warnings.push(`Ignored invalid Port: ${value}`)
        }
        break
      }
      case 'identityfile':
        current.values.identityFile ??= value
        break
    }
  }

  const hosts = new Map<string, SshConfigHost>()

  for (const block of blocks) {
    for (const alias of block.aliases) {
      if (!isConcreteHostAlias(alias) || hosts.has(alias)) continue

      hosts.set(alias, {
        alias,
        hostName: block.values.hostName || alias,
        user: block.values.user,
        port: block.values.port,
        identityFile: block.values.identityFile,
        sourcePath: block.sourcePath,
        warnings: block.warnings
      })
    }
  }

  return [...hosts.values()].sort((a, b) => a.alias.localeCompare(b.alias))
}

export function getSshConfigHosts(configPath = join(homedir(), '.ssh', 'config')): SshConfigHost[] {
  const files = readConfigFiles(configPath)
  const hosts = new Map<string, SshConfigHost>()

  for (const file of files) {
    for (const host of parseSshConfig(file.content, file.path)) {
      if (!hosts.has(host.alias)) hosts.set(host.alias, host)
    }
  }

  return [...hosts.values()].sort((a, b) => a.alias.localeCompare(b.alias))
}
