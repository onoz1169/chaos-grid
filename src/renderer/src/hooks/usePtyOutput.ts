import { useState, useRef, useEffect, useCallback } from 'react'
import { listen } from '@tauri-apps/api/event'
import { sendNotification, isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification'
import type { MutableRefObject } from 'react'

function parseCost(text: string): number {
  const match = text.match(/[Cc]ost:\s*\$([0-9]+\.[0-9]+)/)
  return match ? parseFloat(match[1]) : 0
}

const WAITING_PATTERNS = [
  /^\? /m,
  /Do you want to/i,
  /Press Enter/i,
  /\(Y\/n\)/,
  /\(y\/N\)/,
  /Continue\?/i,
  /y\/n/i,
  /^.*> $/m,
]

function detectWaiting(buffer: string): boolean {
  const tail = buffer.slice(-1000)
  return WAITING_PATTERNS.some((re) => re.test(tail))
}

function detectPort(buffer: string): string | undefined {
  const match = buffer.match(/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d{4,5})/)
  return match ? `:${match[1]}` : undefined
}

interface UsePtyOutputOptions {
  cellId: string
  onActivity: (id: string) => void
  onPtyData: (data: string) => void
  cellStateRef: MutableRefObject<{ theme: string }>
}

interface UsePtyOutputResult {
  waiting: boolean
  detectedPort: string | undefined
  sessionCost: number
}

export function usePtyOutput(options: UsePtyOutputOptions): UsePtyOutputResult {
  const { cellId, onActivity, onPtyData, cellStateRef } = options

  // Store callbacks in refs so the listener closure always sees the latest
  const onPtyDataRef = useRef(onPtyData)
  onPtyDataRef.current = onPtyData
  const onActivityRef = useRef(onActivity)
  onActivityRef.current = onActivity

  const outputBufferRef = useRef('')
  const waitingRef = useRef(false)
  const [waiting, setWaiting] = useState(false)
  const [detectedPort, setDetectedPort] = useState<string | undefined>(undefined)

  const sessionCostRef = useRef(0)
  const [sessionCost, setSessionCost] = useState(0)

  useEffect(() => {
    let mounted = true
    let unlistenFn: (() => void) | null = null

    listen<{ cellId: string; data: string }>('pty-data', (event) => {
      if (event.payload.cellId !== cellId) return
      onPtyDataRef.current(event.payload.data)
      onActivityRef.current(cellId)

      // Waiting detection: maintain rolling buffer of last 1000 chars
      outputBufferRef.current += event.payload.data
      if (outputBufferRef.current.length > 2000) {
        outputBufferRef.current = outputBufferRef.current.slice(-1000)
      }

      // If new output is substantial (50+ chars), reset waiting state
      if (event.payload.data.length >= 50) {
        if (waitingRef.current) {
          waitingRef.current = false
          setWaiting(false)
        }
      } else {
        const isWaiting = detectWaiting(outputBufferRef.current)
        if (isWaiting !== waitingRef.current) {
          if (isWaiting && !waitingRef.current) {
            // Notify when transitioning from non-waiting to waiting
            isPermissionGranted().then(granted => {
              if (!granted) return requestPermission().then(p => p === 'granted')
              return true
            }).then(ok => {
              if (ok) {
                sendNotification({
                  title: 'chaos-grid',
                  body: `[${cellStateRef.current.theme || cellId}] Input needed`,
                })
              }
            }).catch(() => {})
          }
          waitingRef.current = isWaiting
          setWaiting(isWaiting)
        }
      }

      // Port detection
      const port = detectPort(outputBufferRef.current)
      setDetectedPort(port)

      // Cost tracking: parse Claude Code cost output and accumulate
      const cost = parseCost(event.payload.data)
      if (cost > 0) {
        sessionCostRef.current += cost
        setSessionCost(sessionCostRef.current)
      }
    }).then((fn) => {
      if (mounted) {
        unlistenFn = fn
      } else {
        fn()
      }
    })

    return () => {
      mounted = false
      if (unlistenFn) unlistenFn()
    }
  }, [cellId]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    waiting,
    detectedPort,
    sessionCost,
  }
}
