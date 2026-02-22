import { useState, useEffect, useRef, type JSX } from 'react'
import { listen } from '@tauri-apps/api/event'
import type { CellState } from '../../../shared/types'
import { getCellIds, getCellRole, roleColor } from '../../../shared/types'

// eslint-disable-next-line no-control-regex
const ANSI_RE = /[\x1b\x9b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><~]|\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)|\r/g

function stripAnsi(str: string): string {
  return str.replace(ANSI_RE, '')
}

function tailLines(raw: string, n: number): string {
  const lines = stripAnsi(raw).split('\n')
  return lines.slice(-n).join('\n').trimStart()
}

interface OutputViewProps {
  cellStates: Record<string, CellState>
  gridRows: number
  gridCols: number
}

export default function OutputView({ cellStates, gridRows, gridCols }: OutputViewProps): JSX.Element {
  const [outputs, setOutputs] = useState<Record<string, string>>({})
  const bufRef = useRef<Record<string, string>>({})

  // Pre-populate with existing lastOutput from cellStates
  useEffect(() => {
    const initial: Record<string, string> = {}
    getCellIds(gridRows, gridCols).forEach((id) => {
      if (cellStates[id]?.lastOutput) initial[id] = cellStates[id].lastOutput
    })
    bufRef.current = initial
    setOutputs({ ...initial })
  }, [gridRows, gridCols])

  // Live updates
  useEffect(() => {
    let unlisten: (() => void) | null = null
    listen<{ cellId: string; data: string }>('pty-data', (event) => {
      const { cellId, data } = event.payload
      const current = bufRef.current[cellId] ?? ''
      const next = current + data
      bufRef.current = { ...bufRef.current, [cellId]: next.length > 40000 ? next.slice(-40000) : next }
      setOutputs({ ...bufRef.current })
    }).then((fn) => { unlisten = fn })
    return () => { if (unlisten) unlisten() }
  }, [])

  const cellIds = getCellIds(gridRows, gridCols)

  return (
    <div
      className="output-view"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
        gridTemplateRows: `repeat(${gridRows}, 1fr)`,
        gap: 4,
        padding: 8,
        flex: 1,
        overflow: 'hidden',
        background: '#0a0a0a',
      }}
    >
      {cellIds.map((id) => {
        const state = cellStates[id]
        const role = getCellRole(id, gridCols)
        const color = roleColor(role)
        const content = tailLines(outputs[id] ?? '', 60)
        const statusColor =
          state?.status === 'active' ? '#00ff88' :
          state?.status === 'thinking' ? '#ffcc00' : '#333'

        return (
          <div
            key={id}
            style={{
              background: '#0f0f0f',
              border: `1px solid ${color}22`,
              borderTop: `2px solid ${color}66`,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              minHeight: 0,
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: '3px 8px',
                borderBottom: `1px solid #1a1a1a`,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: statusColor, flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 9, color, fontWeight: 700, letterSpacing: 1, flexShrink: 0 }}>
                {role.toUpperCase()}
              </span>
              <span
                style={{
                  fontSize: 11, color: '#888',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {state?.theme || id}
              </span>
            </div>

            {/* Output */}
            <div
              style={{
                flex: 1,
                overflow: 'hidden',
                padding: '6px 8px',
                fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
                fontSize: 11,
                color: '#ccc',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                lineHeight: 1.5,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
              }}
            >
              {content
                ? content
                : <span style={{ color: '#2a2a2a' }}>no output</span>
              }
            </div>
          </div>
        )
      })}
    </div>
  )
}
