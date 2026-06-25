import { readdirSync, statSync, existsSync } from 'fs'
import { join } from 'path'
import { getSettings } from './settings'

/**
 * Sanitize a filename: replace spaces and special chars with underscores.
 */
export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_')
}

/**
 * Generate a timestamp-based filename for screenshots.
 * Format: 2026-06-25_143015.png (preserves extension)
 */
export function timestampFilename(originalName: string): string {
  const ext = originalName.match(/\.[^.]+$/)?.[0] || '.png'
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `${ts}${ext}`
}

/**
 * Find the most recent file in the screenshot directory.
 * Returns null if directory is empty or doesn't exist.
 */
export function getLatestScreenshot(): string | null {
  const settings = getSettings()
  const dir = settings.screenshotDir

  if (!existsSync(dir)) return null

  const files = readdirSync(dir)
    .filter((f) => /\.(png|jpg|jpeg|gif|webp)$/i.test(f))
    .map((f) => ({
      name: f,
      path: join(dir, f),
      mtime: statSync(join(dir, f)).mtime.getTime()
    }))
    .sort((a, b) => b.mtime - a.mtime)

  return files.length > 0 ? files[0].path : null
}
