import { useEffect, useState } from 'react'
import type { SendProgress, SendStatus } from '../../../main/types'

export function useFlingStatus() {
  const [status, setStatus] = useState<SendStatus>('idle')
  const [progress, setProgress] = useState<SendProgress | null>(null)

  useEffect(() => {
    const unsubscribe = window.filefling.onStatus((p) => {
      setProgress(p)
      setStatus(p.status)

      // Reset to idle after a delay
      if (p.status === 'success' || p.status === 'error') {
        setTimeout(() => {
          setStatus('idle')
          setProgress(null)
        }, 3000)
      }
    })
    return unsubscribe
  }, [])

  return { status, progress }
}
