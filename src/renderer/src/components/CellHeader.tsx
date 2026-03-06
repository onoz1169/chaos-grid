import { useState, useRef, useEffect, type JSX } from 'react'
import type { CellState } from '../../../shared/types'
import { getCellRole, ROLE_COLORS } from '../../../shared/types'

interface CellHeaderProps {
  cellState: CellState
  naming?: boolean
  waiting?: boolean
  workDir?: string
  detectedPort?: string
  cpuPct?: number
  sessionCost?: number
  onThemeChange: (id: string, theme: string) => void
  onLaunch: () => void
  onClose: () => void
}

const STATUS_COLORS: Record<CellState['status'], string> = {
  idle: '#444',
  active: '#00ff88',
  thinking: '#ffcc00',
}

function shortenPath(p: string): string {
  const home = p.replace(/^\/Users\/[^/]+/, '~')
  return home.length > 30 ? '...' + home.slice(-27) : home
}

export default function CellHeader({ cellState, naming = false, waiting = false, workDir, detectedPort, cpuPct = 0, sessionCost, onThemeChange, onLaunch, onClose }: CellHeaderProps): JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(cellState.theme)
  const inputRef = useRef<HTMLInputElement>(null)
  const role = getCellRole(cellState.id)
  const roleColor = ROLE_COLORS[role]

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  // Sync draft when theme is set externally (e.g. auto-named)
  useEffect(() => {
    if (!editing) setDraft(cellState.theme)
  }, [cellState.theme, editing])

  const commitEdit = (): void => {
    setEditing(false)
    if (draft.trim() && draft !== cellState.theme) {
      onThemeChange(cellState.id, draft.trim())
    } else {
      setDraft(cellState.theme)
    }
  }

  const displayName = naming && !cellState.theme ? '...' : (cellState.theme || '—')
  const nameColor = naming && !cellState.theme
    ? '#555'
    : cellState.theme ? roleColor : '#444'

  const cpuColor = cpuPct >= 10 ? '#00ff88' : cpuPct >= 2 ? '#ffcc00' : '#444'
  const hasMetadata = workDir || detectedPort || cpuPct >= 2 || (sessionCost ?? 0) > 0

  return (
    <div className="cell-header-wrapper">
    <div className="cell-header" style={{ borderBottom: hasMetadata ? 'none' : `1px solid ${roleColor}22` }}>
      <span className="status-dot" style={{ background: waiting ? '#ffcc00' : STATUS_COLORS[cellState.status] }} />

      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitEdit()
            if (e.key === 'Escape') { setDraft(cellState.theme); setEditing(false) }
          }}
          style={{
            background: '#1a1a1a', border: `1px solid ${roleColor}`,
            color: '#e0e0e0', fontFamily: 'inherit', fontSize: 11,
            padding: '1px 4px', outline: 'none', flex: 1, minWidth: 0,
          }}
        />
      ) : (
        <span
          onClick={() => { setDraft(cellState.theme); setEditing(true) }}
          style={{ fontSize: 13, fontWeight: 600, color: nameColor, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text', minWidth: 40 }}
          title={naming && !cellState.theme ? 'Generating name...' : 'Click to name this cell'}
        >
          {displayName}
        </span>
      )}

      <button
        className="btn-icon"
        onClick={onLaunch}
        title="Launch"
        style={{ color: `${roleColor}cc`, fontSize: 12 }}
        onMouseEnter={e => { e.currentTarget.style.color = roleColor }}
        onMouseLeave={e => { e.currentTarget.style.color = `${roleColor}cc` }}
      >▶</button>
      <button
        className="btn-icon"
        onClick={onClose}
        title="Close terminal"
        style={{ color: '#666', fontSize: 12 }}
        onMouseEnter={e => { e.currentTarget.style.color = '#ff4466' }}
        onMouseLeave={e => { e.currentTarget.style.color = '#666' }}
      >✕</button>
    </div>
    {hasMetadata && (
      <div className="cell-metadata" style={{ borderBottom: `1px solid ${roleColor}22` }}>
        {workDir && <span>{shortenPath(workDir)}</span>}
        {detectedPort && <span style={{ marginLeft: workDir ? 6 : 0 }}>{detectedPort}</span>}
        {cpuPct >= 2 && (
          <span style={{ marginLeft: 'auto', color: cpuColor, fontVariantNumeric: 'tabular-nums' }}>
            CPU {Math.round(cpuPct)}%
          </span>
        )}
        {(sessionCost ?? 0) > 0 && (
          <span style={{
            marginLeft: 'auto',
            color: sessionCost! >= 1.0 ? '#ff4466' : sessionCost! >= 0.1 ? '#ffcc00' : '#aaa',
            fontVariantNumeric: 'tabular-nums',
            fontSize: 9,
          }}>
            ${sessionCost!.toFixed(4)}
          </span>
        )}
      </div>
    )}
    </div>
  )
}
