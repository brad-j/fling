// Generate FileFling's tray PNG icons and packaged macOS app icon without relying
// on Electron/Chromium SVG rendering. Electron's nativeImage.createFromDataURL()
// does not rasterize SVG reliably on macOS, so the app loads generated PNG
// assets instead.
//
// Usage: pnpm icons:generate

import { deflateSync } from 'zlib'
import { mkdirSync, rmSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { spawnSync } from 'child_process'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const TRAY_OUT_DIR = join(ROOT, 'src', 'main', 'icons')
const BUILD_DIR = join(ROOT, 'build')
const ICONSET_DIR = join(BUILD_DIR, 'icon.iconset')
const APP_ICON = join(BUILD_DIR, 'icon.icns')
const SUPERSAMPLE = 4
const VIEWBOX = 32
const TRAY_STROKE_WIDTH = 2.5

// Keep the packaged macOS icon visually identical to the website favicon:
// dark rounded square, green north-east fling arrow.
const APP_ICON_VIEWBOX = 64
const APP_ICON_CORNER_RADIUS = 16
const APP_ICON_STROKE_WIDTH = 5

const STATES = [
  { name: 'idleTemplate', color: '#000000' },
  { name: 'sending', color: '#b6ff3b' },
  { name: 'success', color: '#22c55e' },
  { name: 'error', color: '#ef4444' }
]

const SEGMENTS = [
  // Tray icon: upload arrow shaft
  [16, 4, 16, 22],
  // Tray icon: upload arrow head
  [8, 12, 16, 4],
  [16, 4, 24, 12],
  // Tray icon: base line
  [6, 26, 26, 26]
]

const APP_ICON_SEGMENTS = [
  // Website favicon path: M16 48L48 16M30 16H48V34
  [16, 48, 48, 16],
  [30, 16, 48, 16],
  [48, 16, 48, 34]
]

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value))
}

function parseHexColor(hex) {
  const value = hex.replace('#', '')
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16)
  }
}

function lerp(a, b, t) {
  return Math.round(a + (b - a) * t)
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

function lineCoverageAt(viewX, viewY, strokeWidth) {
  const radius = strokeWidth / 2
  let alpha = 0

  for (const [x1, y1, x2, y2] of SEGMENTS) {
    const distance = distanceToSegment(viewX, viewY, x1, y1, x2, y2)
    alpha = Math.max(alpha, clamp(radius + 0.5 - distance))
  }

  return alpha
}

function segmentCoverageAt(segments, viewX, viewY, strokeWidth, antialiasWidth) {
  const radius = strokeWidth / 2
  let alpha = 0

  for (const [x1, y1, x2, y2] of segments) {
    const distance = distanceToSegment(viewX, viewY, x1, y1, x2, y2)
    alpha = Math.max(alpha, clamp((radius + antialiasWidth - distance) / (2 * antialiasWidth)))
  }

  return alpha
}

function drawTrayIcon(size, hexColor) {
  const { r, g, b } = parseHexColor(hexColor)
  const hiSize = size * SUPERSAMPLE
  const hi = new Uint8ClampedArray(hiSize * hiSize)

  for (let y = 0; y < hiSize; y++) {
    for (let x = 0; x < hiSize; x++) {
      const viewX = ((x + 0.5) / hiSize) * VIEWBOX
      const viewY = ((y + 0.5) / hiSize) * VIEWBOX
      hi[y * hiSize + x] = lineCoverageAt(viewX, viewY, TRAY_STROKE_WIDTH) * 255
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

function roundedRectAlpha(x, y, size, radius) {
  const half = size / 2
  const qx = Math.abs(x - half) - (half - radius)
  const qy = Math.abs(y - half) - (half - radius)
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0))
  const inside = Math.min(Math.max(qx, qy), 0)
  const signedDistance = outside + inside - radius
  return clamp(0.5 - signedDistance)
}

function drawAppIcon(size) {
  const bg = parseHexColor('#04070a')
  const glyph = parseHexColor('#34f5a0')
  const hiSize = size * SUPERSAMPLE
  const hi = Buffer.alloc(hiSize * hiSize * 4)
  const rectRadius = hiSize * (APP_ICON_CORNER_RADIUS / APP_ICON_VIEWBOX)
  const viewUnitsPerHiPixel = APP_ICON_VIEWBOX / hiSize
  const antialiasWidth = viewUnitsPerHiPixel * 0.75

  for (let y = 0; y < hiSize; y++) {
    for (let x = 0; x < hiSize; x++) {
      const viewX = ((x + 0.5) / hiSize) * APP_ICON_VIEWBOX
      const viewY = ((y + 0.5) / hiSize) * APP_ICON_VIEWBOX
      const rectAlpha = roundedRectAlpha(x + 0.5, y + 0.5, hiSize, rectRadius)
      const glyphAlpha = segmentCoverageAt(
        APP_ICON_SEGMENTS,
        viewX,
        viewY,
        APP_ICON_STROKE_WIDTH,
        antialiasWidth
      ) * rectAlpha

      const i = (y * hiSize + x) * 4
      hi[i] = lerp(bg.r, glyph.r, glyphAlpha)
      hi[i + 1] = lerp(bg.g, glyph.g, glyphAlpha)
      hi[i + 2] = lerp(bg.b, glyph.b, glyphAlpha)
      hi[i + 3] = Math.round(rectAlpha * 255)
    }
  }

  const rgba = Buffer.alloc(size * size * 4)
  const samples = SUPERSAMPLE * SUPERSAMPLE

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0
      let g = 0
      let b = 0
      let a = 0

      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const hiIndex = (((y * SUPERSAMPLE + sy) * hiSize) + (x * SUPERSAMPLE + sx)) * 4
          r += hi[hiIndex]
          g += hi[hiIndex + 1]
          b += hi[hiIndex + 2]
          a += hi[hiIndex + 3]
        }
      }

      const i = (y * size + x) * 4
      rgba[i] = Math.round(r / samples)
      rgba[i + 1] = Math.round(g / samples)
      rgba[i + 2] = Math.round(b / samples)
      rgba[i + 3] = Math.round(a / samples)
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

function writePng(file, size, rgba) {
  writeFileSync(file, encodePng(size, size, rgba))
  console.log(`wrote ${file} (${size}x${size})`)
}

function generateTrayIcons() {
  mkdirSync(TRAY_OUT_DIR, { recursive: true })

  for (const { name, color } of STATES) {
    for (const size of [16, 32]) {
      const file = join(TRAY_OUT_DIR, `${name}${size === 32 ? '@2x' : ''}.png`)
      writePng(file, size, drawTrayIcon(size, color))
    }
  }
}

function generateAppIcon() {
  mkdirSync(BUILD_DIR, { recursive: true })
  rmSync(ICONSET_DIR, { recursive: true, force: true })
  mkdirSync(ICONSET_DIR, { recursive: true })

  const iconsetEntries = [
    ['icon_16x16.png', 16],
    ['icon_16x16@2x.png', 32],
    ['icon_32x32.png', 32],
    ['icon_32x32@2x.png', 64],
    ['icon_128x128.png', 128],
    ['icon_128x128@2x.png', 256],
    ['icon_256x256.png', 256],
    ['icon_256x256@2x.png', 512],
    ['icon_512x512.png', 512],
    ['icon_512x512@2x.png', 1024]
  ]

  for (const [fileName, size] of iconsetEntries) {
    writePng(join(ICONSET_DIR, fileName), size, drawAppIcon(size))
  }

  const result = spawnSync('iconutil', ['-c', 'icns', ICONSET_DIR, '-o', APP_ICON], {
    stdio: 'inherit'
  })

  if (result.status !== 0) {
    throw new Error('iconutil failed to generate build/icon.icns')
  }

  rmSync(ICONSET_DIR, { recursive: true, force: true })
  console.log(`wrote ${APP_ICON}`)
}

generateTrayIcons()
generateAppIcon()
