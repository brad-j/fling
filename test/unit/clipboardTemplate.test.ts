import { describe, expect, it } from 'vitest'
import { renderClipboardTemplate } from '../../src/main/clipboardTemplate'

const context = {
  remotePath: '/home/alice/shared/screenshot.png',
  filename: 'screenshot.png',
  host: 'devbox',
  username: 'alice',
  timestamp: Date.parse('2026-06-25T14:30:15.000Z')
}

describe('clipboard template rendering', () => {
  it('renders the default raw remote path template', () => {
    expect(renderClipboardTemplate('{{remotePath}}', context)).toBe('/home/alice/shared/screenshot.png')
  })

  it('renders supported tokens inside arbitrary text', () => {
    expect(renderClipboardTemplate('Please inspect {{filename}} at {{remotePath}} on {{host}} as {{username}}.', context))
      .toBe('Please inspect screenshot.png at /home/alice/shared/screenshot.png on devbox as alice.')
  })

  it('renders timestamps as ISO strings', () => {
    expect(renderClipboardTemplate('Uploaded at {{timestamp}}', context))
      .toBe('Uploaded at 2026-06-25T14:30:15.000Z')
  })

  it('allows whitespace inside token braces', () => {
    expect(renderClipboardTemplate('Look: {{ remotePath }}', context))
      .toBe('Look: /home/alice/shared/screenshot.png')
  })

  it('leaves unknown placeholders visible', () => {
    expect(renderClipboardTemplate('{{remotePath}} {{unknownToken}}', context))
      .toBe('/home/alice/shared/screenshot.png {{unknownToken}}')
  })

  it('supports multiline templates', () => {
    expect(renderClipboardTemplate('Uploaded files:\n- {{remotePath}}', context))
      .toBe('Uploaded files:\n- /home/alice/shared/screenshot.png')
  })
})
