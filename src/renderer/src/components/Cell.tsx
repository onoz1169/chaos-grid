import { useState, useEffect, useRef, type JSX } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { CellState } from '../../../shared/types'
import CellHeader from './CellHeader'

const AUTO_NAME_OUTPUT_THRESHOLD = 1500 // chars of post-input PTY output before triggering

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

interface CellProps {
  cellState: CellState
  onThemeChange: (id: string, theme: string) => void
  onActivity: (id: string) => void
  compact?: boolean
  workDir?: string
  toolCmd?: string
  onClose?: () => void
}

export default function Cell({ cellState, onThemeChange, onActivity, compact = false, workDir, toolCmd, onClose }: CellProps): JSX.Element {
  const terminalRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const spawnedRef = useRef(false)

  // Auto-naming: ref for use inside event listener closure, state for UI
  const rawOutputRef = useRef('')
  const userSubmittedRef = useRef(false) // true after user presses Enter
  const namingRef = useRef(false)
  const [naming, setNaming] = useState(false)
  const cellStateRef = useRef(cellState)

  // Waiting detection
  const outputBufferRef = useRef('')
  const waitingRef = useRef(false)
  const [waiting, setWaiting] = useState(false)
  const [detectedPort, setDetectedPort] = useState<string | undefined>(undefined)

  useEffect(() => {
    cellStateRef.current = cellState
  }, [cellState])

  // Reset when theme is cleared (allows re-naming)
  useEffect(() => {
    if (!cellState.theme) {
      namingRef.current = false
      userSubmittedRef.current = false
      setNaming(false)
      rawOutputRef.current = ''
    }
  }, [cellState.theme])

  useEffect(() => {
    if (!terminalRef.current || termRef.current) return

    const term = new Terminal({
      theme: {
        background: '#0a0a0a',
        foreground: '#e0e0e0',
        cursor: '#00ff88',
        black: '#1a1a1a',
        green: '#00ff88',
        yellow: '#ffcc00',
        blue: '#4488ff'
      },
      fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
      fontSize: compact ? 11 : 13,
      cursorBlink: true
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(terminalRef.current)
    fitAddon.fit()
    termRef.current = term

    if (!spawnedRef.current) {
      spawnedRef.current = true
      const { cols, rows } = term
      invoke('spawn_pty', { cellId: cellState.id, cols, rows })
    }

    term.onData((data) => {
      invoke('write_pty', { cellId: cellState.id, data })
      // Track first Enter press — only accumulate output after user has submitted
      if (!userSubmittedRef.current && (data === '\r' || data === '\n')) {
        userSubmittedRef.current = true
        rawOutputRef.current = '' // discard startup noise
      }
    })

    let mounted = true
    let unlistenFn: (() => void) | null = null

    listen<{ cellId: string; data: string }>('pty-data', (event) => {
      if (event.payload.cellId !== cellState.id) return
      term.write(event.payload.data)
      onActivity(cellState.id)

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
          }).then((name) => {
            const trimmed = name.trim()
            if (trimmed && !cellStateRef.current.theme) {
              onThemeChange(cellState.id, trimmed)
            }
            setNaming(false)
          }).catch(() => {
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

    const resizeObserver = new ResizeObserver(() => {
      if (!terminalRef.current || terminalRef.current.offsetWidth === 0 || terminalRef.current.offsetHeight === 0) return
      fitAddon.fit()
      invoke('resize_pty', { cellId: cellState.id, cols: term.cols, rows: term.rows })
    })
    resizeObserver.observe(terminalRef.current)

    return () => {
      mounted = false
      if (unlistenFn) unlistenFn()
      resizeObserver.disconnect()
      term.dispose()
      termRef.current = null
    }
  }, [cellState.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleLaunch = (): void => {
    invoke('launch_cell', { cellId: cellState.id, workDir: workDir || null, toolCmd: toolCmd || null })
  }

  const handleClose = (): void => {
    invoke('kill_pty', { cellId: cellState.id })
    onClose?.()
  }

  return (
    <div
      className={`cell${waiting ? ' cell-waiting' : ''}`}
      style={{
        borderLeft: waiting ? '2px solid #ffcc00' : '2px solid #333',
        animation: waiting ? 'pulse-border 1s ease-in-out infinite' : 'none',
        transition: waiting ? 'none' : 'border-color 1s ease',
      }}
    >
      <CellHeader
        cellState={cellState}
        naming={naming}
        waiting={waiting}
        workDir={workDir}
        detectedPort={detectedPort}
        onThemeChange={onThemeChange}
        onLaunch={handleLaunch}
        onClose={handleClose}
      />
      <div className="terminal-container" ref={terminalRef} />
    </div>
  )
}
