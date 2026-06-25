// Generate the Fling tray PNG icons without relying on Electron/Chromium SVG
// rendering. Electron's nativeImage.createFromDataURL() does not rasterize SVG
// reliably on macOS, so the app loads these PNG assets instead.
//
// Usage: pnpm icons:generate

import { deflateSync } from 'zlib'
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'src', 'main', 'icons')
const SUPERSAMPLE = 4
const VIEWBOX = 32
const STROKE_WIDTH = 2.5

const STATES = [
  { name: 'idleTemplate', color: '#000000' },
  { name: 'sending', color: '#6366f1' },
  { name: 'success', color: '#22c55e' },
  { name: 'error', color: '#ef4444' }
]

const SEGMENTS = [
  // Arrow shaft
  [16, 4, 16, 22],
  // Arrow head
  [8, 12, 16, 4],
  [16, 4, 24, 12],
  // Base line
  [6, 26, 26, 26]
]

function parseHexColor(hex) {
  const value = hex.replace('#', '')
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16)
  }
}

function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1
  const dy = y2 - y1
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return Math.hypot(px - x1, py - y1)

  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared))
  const x = x1 + t * dx
  const y = y1 + t * dy
  return Math.hypot(px - x, py - y)
}

function coverageAt(viewX, viewY) {
  const radius = STROKE_WIDTH / 2
  for (const [x1, y1, x2, y2] of SEGMENTS) {
    if (distanceToSegment(viewX, viewY, x1, y1, x2, y2) <= radius) {
      return 1
    }
  }
  return 0
}

function drawIcon(size, hexColor) {
  const { r, g, b } = parseHexColor(hexColor)
  const hiSize = size * SUPERSAMPLE
  const hi = new Uint8ClampedArray(hiSize * hiSize)

  for (let y = 0; y < hiSize; y++) {
    for (let x = 0; x < hiSize; x++) {
      const viewX = ((x + 0.5) / hiSize) * VIEWBOX
      const viewY = ((y + 0.5) / hiSize) * VIEWBOX
      hi[y * hiSize + x] = coverageAt(viewX, viewY) * 255
    }
  }

  const rgba = Buffer.alloc(size * size * 4)
  const samples = SUPERSAMPLE * SUPERSAMPLE

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let alphaSum = 0
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const hx = x * SUPERSAMPLE + sx
          const hy = y * SUPERSAMPLE + sy
          alphaSum += hi[hy * hiSize + hx]
        }
      }

      const i = (y * size + x) * 4
      rgba[i] = r
      rgba[i + 1] = g
      rgba[i + 2] = b
      rgba[i + 3] = Math.round(alphaSum / samples)
    }
  }

  return rgba
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)

  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)

  return Buffer.concat([length, typeBuffer, data, crc])
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace

  const stride = width * 4
  const scanlines = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    scanlines[y * (stride + 1)] = 0 // no filter
    rgba.copy(scanlines, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(scanlines)),
    chunk('IEND')
  ])
}

mkdirSync(OUT_DIR, { recursive: true })

for (const { name, color } of STATES) {
  for (const size of [16, 32]) {
    const rgba = drawIcon(size, color)
    const png = encodePng(size, size, rgba)
    const file = join(OUT_DIR, `${name}${size === 32 ? '@2x' : ''}.png`)
    writeFileSync(file, png)
    console.log(`wrote ${file} (${size}x${size})`)
  }
}
