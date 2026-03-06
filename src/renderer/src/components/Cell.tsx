import { useState, useEffect, useRef, useCallback, type JSX } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { invoke } from '@tauri-apps/api/core'
import type { CellState } from '../../../shared/types'
import CellHeader from './CellHeader'
import { usePtyOutput } from '../hooks/usePtyOutput'

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
  const cellStateRef = useRef(cellState)

  const [autoRestart, setAutoRestart] = useState(() => localStorage.getItem(`chaos-grid-auto-restart-${cellState.id}`) === 'true')
  const handleToggleAutoRestart = (): void => {
    const next = !autoRestart
    setAutoRestart(next)
    localStorage.setItem(`chaos-grid-auto-restart-${cellState.id}`, String(next))
  }

  useEffect(() => {
    cellStateRef.current = cellState
  }, [cellState])

  const handlePtyData = useCallback((data: string) => {
    termRef.current?.write(data)
  }, [])

  const { waiting, detectedPort, naming, userSubmittedRef, rawOutputRef, resetNaming, sessionCost } = usePtyOutput({
    cellId: cellState.id,
    onActivity,
    onThemeChange,
    onPtyData: handlePtyData,
    cellStateRef,
  })

  // CPU polling — 2s interval while cell has a live PID
  const [cpuPct, setCpuPct] = useState(0)
  useEffect(() => {
    if (!cellState.pid) { setCpuPct(0); return }
    const poll = (): void => {
      invoke<number>('get_cell_cpu', { cellId: cellState.id }).then(setCpuPct).catch(() => {})
    }
    poll()
    const id = setInterval(poll, 2000)
    return () => clearInterval(id)
  }, [cellState.id, cellState.pid])

  // Auto-restart: listen for pty-exited and re-launch if enabled
  useEffect(() => {
    let unlisten: (() => void) | null = null
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen<{ cellId: string }>('pty-exited', (event) => {
        if (event.payload.cellId !== cellState.id) return
        if (localStorage.getItem(`chaos-grid-auto-restart-${cellState.id}`) === 'true') {
          setTimeout(() => {
            invoke('launch_cell', { cellId: cellState.id, workDir: workDir || null, toolCmd: toolCmd || null })
          }, 2000)
        }
      }).then(fn => { unlisten = fn })
    })
    return () => { unlisten?.() }
  }, [cellState.id, workDir, toolCmd])

  // Reset when theme is cleared (allows re-naming)
  useEffect(() => {
    if (!cellState.theme) {
      resetNaming()
    }
  }, [cellState.theme, resetNaming])

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

    const resizeObserver = new ResizeObserver(() => {
      if (!terminalRef.current || terminalRef.current.offsetWidth === 0 || terminalRef.current.offsetHeight === 0) return
      fitAddon.fit()
      invoke('resize_pty', { cellId: cellState.id, cols: term.cols, rows: term.rows })
    })
    resizeObserver.observe(terminalRef.current)

    return () => {
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
        transition: waiting ? 'none' : 'border-color 1s ease',
      }}
    >
      <CellHeader
        cellState={cellState}
        naming={naming}
        waiting={waiting}
        workDir={workDir}
        detectedPort={detectedPort}
        cpuPct={cpuPct}
        sessionCost={sessionCost}
        autoRestart={autoRestart}
        onThemeChange={onThemeChange}
        onLaunch={handleLaunch}
        onClose={handleClose}
        onToggleAutoRestart={handleToggleAutoRestart}
      />
      <div className="terminal-container" ref={terminalRef} />
    </div>
  )
}
