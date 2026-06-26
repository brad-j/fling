import { mkdtempSync, mkdirSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { getSshConfigHosts, parseSshConfig } from '../../src/main/sshConfig'

describe('SSH config parsing', () => {
  it('parses concrete Host blocks into selectable destinations', () => {
    const hosts = parseSshConfig(`
Host devbox
  HostName 100.64.1.2
  User brad
  Port 2222
  IdentityFile ~/.ssh/id_ed25519

Host *.internal
  User ignored

Host work laptop
  HostName work.example.com
  User alice
`)

    expect(hosts).toEqual([
      {
        alias: 'devbox',
        hostName: '100.64.1.2',
        user: 'brad',
        port: 2222,
        identityFile: '~/.ssh/id_ed25519',
        sourcePath: undefined,
        warnings: []
      },
      {
        alias: 'laptop',
        hostName: 'work.example.com',
        user: 'alice',
        port: undefined,
        identityFile: undefined,
        sourcePath: undefined,
        warnings: []
      },
      {
        alias: 'work',
        hostName: 'work.example.com',
        user: 'alice',
        port: undefined,
        identityFile: undefined,
        sourcePath: undefined,
        warnings: []
      }
    ])
  })

  it('handles quoted values and inline comments', () => {
    const hosts = parseSshConfig(`
Host "quoted-host"
  HostName "example.com" # comment
  User 'alice smith'
`)

    expect(hosts[0]).toMatchObject({
      alias: 'quoted-host',
      hostName: 'example.com',
      user: 'alice smith'
    })
  })

  it('keeps first value for duplicate directives', () => {
    const hosts = parseSshConfig(`
Host devbox
  HostName first.example.com
  HostName second.example.com
  IdentityFile ~/.ssh/first
  IdentityFile ~/.ssh/second
`)

    expect(hosts[0].hostName).toBe('first.example.com')
    expect(hosts[0].identityFile).toBe('~/.ssh/first')
  })

  it('reads included config files', () => {
    const root = mkdtempSync(join(tmpdir(), 'filefling-ssh-config-'))
    const includeDir = join(root, 'conf.d')
    mkdirSync(includeDir)

    const mainPath = join(root, 'config')
    const includedPath = join(includeDir, 'dev.conf')

    writeFileSync(mainPath, `
Include conf.d/*.conf
Host main
  HostName main.example.com
`)
    writeFileSync(includedPath, `
Host included
  HostName included.example.com
  User brad
`)

    expect(getSshConfigHosts(mainPath).map((host) => host.alias)).toEqual(['included', 'main'])
  })
})
