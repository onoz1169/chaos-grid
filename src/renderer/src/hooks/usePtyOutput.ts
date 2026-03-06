import { useState, useRef, useEffect, useCallback } from 'react'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import type { MutableRefObject } from 'react'

function parseCost(text: string): number {
  const match = text.match(/[Cc]ost:\s*\$([0-9]+\.[0-9]+)/)
  return match ? parseFloat(match[1]) : 0
}

const AUTO_NAME_OUTPUT_THRESHOLD = 1500

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
  onThemeChange: (id: string, theme: string) => void
  onPtyData: (data: string) => void
  cellStateRef: MutableRefObject<{ theme: string }>
}

interface UsePtyOutputResult {
  waiting: boolean
  detectedPort: string | undefined
  naming: boolean
  userSubmittedRef: MutableRefObject<boolean>
  rawOutputRef: MutableRefObject<string>
  namingRef: MutableRefObject<boolean>
  resetNaming: () => void
  sessionCost: number
}

export function usePtyOutput(options: UsePtyOutputOptions): UsePtyOutputResult {
  const { cellId, onActivity, onThemeChange, onPtyData, cellStateRef } = options

  // Store callbacks in refs so the listener closure always sees the latest
  const onPtyDataRef = useRef(onPtyData)
  onPtyDataRef.current = onPtyData
  const onActivityRef = useRef(onActivity)
  onActivityRef.current = onActivity
  const onThemeChangeRef = useRef(onThemeChange)
  onThemeChangeRef.current = onThemeChange

  const outputBufferRef = useRef('')
  const waitingRef = useRef(false)
  const [waiting, setWaiting] = useState(false)
  const [detectedPort, setDetectedPort] = useState<string | undefined>(undefined)

  const rawOutputRef = useRef('')
  const userSubmittedRef = useRef(false)
  const namingRef = useRef(false)
  const [naming, setNaming] = useState(false)

  const sessionCostRef = useRef(0)
  const [sessionCost, setSessionCost] = useState(0)

  const resetNaming = useCallback((): void => {
    namingRef.current = false
    userSubmittedRef.current = false
    setNaming(false)
    rawOutputRef.current = ''
  }, [])

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

      // Auto-name: accumulate output after first user submit, fire once threshold is crossed
      if (!namingRef.current && !cellStateRef.current.theme && userSubmittedRef.current) {
        rawOutputRef.current += event.payload.data
        if (rawOutputRef.current.length >= AUTO_NAME_OUTPUT_THRESHOLD) {
          namingRef.current = true
          setNaming(true)
          const language = localStorage.getItem('chaos-grid-language') ?? 'Japanese'
          invoke<string>('suggest_cell_name', {
            output: rawOutputRef.current,
            language,
          })
            .then((name) => {
              const trimmed = name.trim()
              if (trimmed && !cellStateRef.current.theme) {
                onThemeChangeRef.current(cellId, trimmed)
              }
              setNaming(false)
            })
            .catch(() => {
              namingRef.current = false
              setNaming(false)
            })
        }
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
    naming,
    userSubmittedRef,
    rawOutputRef,
    namingRef,
    resetNaming,
    sessionCost,
  }
}
