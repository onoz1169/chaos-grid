import type { JSX } from 'react'
import type { CellState } from '../../../shared/types'
import { CELL_IDS, COL_LABELS } from '../../../shared/types'
import Cell from './Cell'
import SynthesisPanel from './SynthesisPanel'

export type ViewMode = 'grid' | 'command'

interface GridProps {
  cellStates: Record<string, CellState>
  cellActivity: Record<string, number>
  viewMode: ViewMode
  onThemeChange: (id: string, theme: string) => void
  onActivity: (id: string) => void
}

const COL_COLORS: Record<string, string> = {
  'Supply': '#00ff88',
  'Will': '#bb8844',
  'Stimulus': '#4488bb',
}

function GridInner({ cellStates, onThemeChange, onActivity, compact }: {
  cellStates: Record<string, CellState>
  onThemeChange: (id: string, theme: string) => void
  onActivity: (id: string) => void
  compact?: boolean
}): JSX.Element {
  const defaultState = (id: string): CellState => ({
    id, theme: '', pid: null, lastOutput: '', status: 'idle', updatedAt: 0
  })

  return (
    <div className="flow-grid-wrapper">
      {/* Column headers */}
      <div className="col-headers">
        {COL_LABELS.map((label) => (
          <div key={label} className="col-header" style={{ color: COL_COLORS[label], borderBottom: `1px solid ${COL_COLORS[label]}44` }}>
            {label}
          </div>
        ))}
      </div>

      {/* 3x3 cells */}
      <div className="grid">
        {CELL_IDS.map((id) => (
          <Cell
            key={id}
            cellState={cellStates[id] || defaultState(id)}
            onThemeChange={onThemeChange}
            onActivity={onActivity}
            compact={compact}
          />
        ))}
      </div>
    </div>
  )
}

export default function Grid({ cellStates, cellActivity, viewMode, onThemeChange, onActivity }: GridProps): JSX.Element {
  if (viewMode === 'command') {
    return (
      <div className="command-layout">
        <div className="command-terminals">
          <GridInner cellStates={cellStates} onThemeChange={onThemeChange} onActivity={onActivity} compact />
        </div>
        <SynthesisPanel cellStates={cellStates} cellActivity={cellActivity} />
      </div>
    )
  }

  return <GridInner cellStates={cellStates} onThemeChange={onThemeChange} onActivity={onActivity} />
}
