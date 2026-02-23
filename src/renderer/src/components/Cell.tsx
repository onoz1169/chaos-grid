import { useEffect, useRef, type JSX } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { CellState } from '../../../shared/types'
import CellHeader from './CellHeader'

interface CellProps {
  cellState: CellState
  onThemeChange: (id: string, theme: string) => void
  onActivity: (id: string) => void
  compact?: boolean
  workDir?: string
  toolCmd?: string
}

export default function Cell({ cellState, onThemeChange, onActivity, compact = false, workDir, toolCmd }: CellProps): JSX.Element {
  const terminalRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const spawnedRef = useRef(false)

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
    })

    let mounted = true
    let unlistenFn: (() => void) | null = null

    listen<{ cellId: string; data: string }>('pty-data', (event) => {
      if (event.payload.cellId === cellState.id) {
        term.write(event.payload.data)
        onActivity(cellState.id)
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
  }, [cellState.id])

  const handleLaunch = (): void => {
    invoke('launch_cell', { cellId: cellState.id, workDir: workDir || null, toolCmd: toolCmd || null })
  }

  const handleKill = (): void => {
    invoke('kill_pty', { cellId: cellState.id })
  }

  return (
    <div
      className="cell"
      style={{ borderLeft: `2px solid #333`, transition: 'border-color 1s ease' }}
    >
      <CellHeader
        cellState={cellState}
        onThemeChange={onThemeChange}
        onLaunch={handleLaunch}
        onKill={handleKill}
      />
      <div className="terminal-container" ref={terminalRef} />
    </div>
  )
}
