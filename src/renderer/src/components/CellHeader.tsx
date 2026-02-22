import { useState, useRef, useEffect } from 'react'
import type { CellState } from '../../../shared/types'

interface CellHeaderProps {
  cellState: CellState
  onThemeChange: (id: string, theme: string) => void
  onLaunch: () => void
  onKill: () => void
}

const STATUS_COLORS: Record<CellState['status'], string> = {
  idle: '#666',
  active: '#00ff88',
  thinking: '#ffcc00'
}

export default function CellHeader({
  cellState,
  onThemeChange,
  onLaunch,
  onKill
}: CellHeaderProps): JSX.Element {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(cellState.theme)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const commitEdit = (): void => {
    setEditing(false)
    if (draft.trim() && draft !== cellState.theme) {
      onThemeChange(cellState.id, draft.trim())
    } else {
      setDraft(cellState.theme)
    }
  }

  return (
    <div className="cell-header">
      <span className="status-dot" style={{ background: STATUS_COLORS[cellState.status] }} />

      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitEdit()
            if (e.key === 'Escape') {
              setDraft(cellState.theme)
              setEditing(false)
            }
          }}
          style={{
            background: '#1a1a1a',
            border: '1px solid #00ff88',
            color: '#e0e0e0',
            fontFamily: 'inherit',
            fontSize: 11,
            padding: '1px 4px',
            outline: 'none',
            flex: 1,
            minWidth: 0
          }}
        />
      ) : (
        <span
          onDoubleClick={() => {
            setDraft(cellState.theme)
            setEditing(true)
          }}
          style={{ fontSize: 11, color: '#aaa', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'default' }}
        >
          {cellState.theme}
        </span>
      )}

      <button className="btn-icon" onClick={onLaunch} title="Launch">
        &#9654;
      </button>
      <button className="btn-icon" onClick={onKill} title="Kill">
        &#10005;
      </button>
    </div>
  )
}
