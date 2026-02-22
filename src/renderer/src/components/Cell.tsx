import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import type { CellState } from '../../../shared/types'
import CellHeader from './CellHeader'

interface CellProps {
  cellState: CellState
  onThemeChange: (id: string, theme: string) => void
}

export default function Cell({ cellState, onThemeChange }: CellProps): JSX.Element {
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
      fontSize: 13,
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
      window.chaosAPI.invoke('chaos:spawn', cellState.id, cols, rows)
    }

    term.onData((data) => {
      window.chaosAPI.invoke('chaos:write', cellState.id, data)
    })

    const cleanup = window.chaosAPI.on('chaos:pty-data', (cellId: string, data: string) => {
      if (cellId === cellState.id) term.write(data)
    })

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
      window.chaosAPI.invoke('chaos:resize', cellState.id, term.cols, term.rows)
    })
    resizeObserver.observe(terminalRef.current)

    return () => {
      cleanup()
      resizeObserver.disconnect()
      term.dispose()
      termRef.current = null
    }
  }, [cellState.id])

  const handleLaunch = (): void => {
    window.chaosAPI.invoke('chaos:launch-cell', cellState.id)
  }

  const handleKill = (): void => {
    window.chaosAPI.invoke('chaos:kill', cellState.id)
  }

  return (
    <div className="cell">
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
