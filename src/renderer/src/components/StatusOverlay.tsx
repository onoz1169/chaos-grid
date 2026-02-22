import type { JSX } from 'react'
import type { CellState, AnalyzeResult } from '../../../shared/types'
import { CELL_IDS } from '../../../shared/types'

interface StatusOverlayProps {
  result: AnalyzeResult
  cellStates: Record<string, CellState>
  onClose: () => void
}

export default function StatusOverlay({ result, cellStates, onClose }: StatusOverlayProps): JSX.Element {
  const now = new Date()
  const timestamp = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  return (
    <div className="overlay">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: 2, color: '#00ff88' }}>
          CHAOS OVERVIEW
        </h1>
        <button
          className="btn-icon"
          onClick={onClose}
          style={{ fontSize: 20, color: '#666' }}
        >
          &#10005;
        </button>
      </div>

      <div className="overlay-grid">
        {CELL_IDS.map((id) => {
          const cell = cellStates[id]
          const summary = result.summaries[id] || 'No data'
          return (
            <div key={id} className="overlay-cell">
              <div style={{ fontSize: 12, color: '#00ff88', marginBottom: 8, fontWeight: 600 }}>
                {cell?.theme || id}
              </div>
              <div style={{ fontSize: 11, color: '#999', lineHeight: 1.5 }}>{summary}</div>
            </div>
          )
        })}
      </div>

      <div style={{ borderTop: '1px solid #222', paddingTop: 16 }}>
        <h2 style={{ fontSize: 14, fontWeight: 600, color: '#00ff88', marginBottom: 12 }}>
          CROSS-THEME IDEAS
        </h2>
        {(result.ideas || []).slice(0, 3).map((idea, i) => (
          <div key={i} className="idea-card">
            <div style={{ fontSize: 12, color: '#e0e0e0', lineHeight: 1.5 }}>{idea}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, color: '#444', textAlign: 'right' }}>
        Analyzed at {timestamp}
      </div>
    </div>
  )
}
