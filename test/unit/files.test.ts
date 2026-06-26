import { mkdirSync, utimesSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { describe, expect, it, vi } from 'vitest'

const mockState = vi.hoisted(() => ({
  screenshotDir: '/tmp'
}))

vi.mock('../../src/main/settings', () => ({
  getSettings: () => ({ screenshotDir: mockState.screenshotDir })
}))

import { getLatestScreenshotInfo, sanitizeFilename, timestampFilename } from '../../src/main/files'

describe('file naming', () => {
  it('removes unsafe filename characters', () => {
    expect(sanitizeFilename('Screenshot 1: hello/world?.png')).toBe('Screenshot_1__hello_world_.png')
  })

  it('keeps safe filename characters', () => {
    expect(sanitizeFilename('build-log_2026.06.26-alpha.txt')).toBe('build-log_2026.06.26-alpha.txt')
  })

  it('creates timestamp screenshot names while preserving extension', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-25T14:30:15'))

    expect(timestampFilename('anything.jpeg')).toBe('2026-06-25_143015.jpeg')

    vi.useRealTimers()
  })
})

describe('latest screenshot lookup', () => {
  it('returns metadata for the newest image file', () => {
    const dir = join(tmpdir(), `filefling-screenshots-${Date.now()}`)
    mkdirSync(dir)
    mockState.screenshotDir = dir

    const older = join(dir, 'older.png')
    const newer = join(dir, 'newer.jpg')
    const ignored = join(dir, 'notes.txt')

    writeFileSync(older, 'old')
    writeFileSync(ignored, 'ignored')
    writeFileSync(newer, 'new-image')
    utimesSync(older, new Date('2026-01-01T00:00:00Z'), new Date('2026-01-01T00:00:00Z'))
    utimesSync(newer, new Date('2026-01-02T00:00:00Z'), new Date('2026-01-02T00:00:00Z'))

    const latest = getLatestScreenshotInfo()

    expect(latest).toMatchObject({
      filePath: newer,
      filename: 'newer.jpg',
      size: Buffer.byteLength('new-image')
    })
    expect(latest?.mtime).toEqual(expect.any(Number))
  })
})
