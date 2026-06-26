import { nativeImage } from 'electron'
import { getLatestScreenshotInfo as getLatestScreenshotFileInfo } from './files'
import type { LatestScreenshotInfo } from './types'

export async function getLatestScreenshotPreview(): Promise<LatestScreenshotInfo | null> {
  const info = getLatestScreenshotFileInfo()
  if (!info) return null

  try {
    const thumbnail = await nativeImage.createThumbnailFromPath(info.filePath, {
      width: 320,
      height: 180
    })

    if (!thumbnail.isEmpty()) {
      return {
        ...info,
        dataUrl: thumbnail.toDataURL()
      }
    }
  } catch {
    // Preview is a convenience. Metadata is still useful if thumbnailing fails.
  }

  return info
}
