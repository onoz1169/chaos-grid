import type { CellState } from '../../../shared/types'
import { CELL_IDS } from '../../../shared/types'
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

export default function Grid({ cellStates, cellActivity, viewMode, onThemeChange, onActivity }: GridProps): JSX.Element {
  const defaultState = (id: string): CellState => ({
    id, theme: '', pid: null, lastOutput: '', status: 'idle', updatedAt: 0
  })

  if (viewMode === 'command') {
    return (
      <div className="command-layout">
        <div className="command-terminals">
          <div className="grid">
            {CELL_IDS.map((id) => (
              <Cell
                key={id}
                cellState={cellStates[id] || defaultState(id)}
                onThemeChange={onThemeChange}
                onActivity={onActivity}
                compact
              />
            ))}
          </div>
        </div>
        <SynthesisPanel cellStates={cellStates} cellActivity={cellActivity} />
      </div>
    )
  }

  return (
    <div className="grid">
      {CELL_IDS.map((id) => (
        <Cell
          key={id}
          cellState={cellStates[id] || defaultState(id)}
          onThemeChange={onThemeChange}
          onActivity={onActivity}
        />
      ))}
    </div>
  )
}
