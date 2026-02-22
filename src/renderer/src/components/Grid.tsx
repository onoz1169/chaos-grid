import type { CellState } from '../../../shared/types'
import { CELL_IDS } from '../../../shared/types'
import Cell from './Cell'
import SynthesisPanel from './SynthesisPanel'

export type ViewMode = 'grid' | 'organism' | 'command'

interface GridProps {
  cellStates: Record<string, CellState>
  cellActivity: Record<string, number>
  viewMode: ViewMode
  onThemeChange: (id: string, theme: string) => void
  onActivity: (id: string) => void
}

function getHeat(cellId: string, cellActivity: Record<string, number>): number {
  const last = cellActivity[cellId]
  if (!last) return 0.5
  const age = Date.now() - last
  if (age < 30_000) return 4      // hot: < 30s
  if (age < 120_000) return 2     // warm: < 2min
  if (age < 300_000) return 1     // cool: < 5min
  return 0.6                       // idle
}

function computeOrganismTemplate(cellActivity: Record<string, number>): { cols: string; rows: string } {
  const heats = CELL_IDS.map((id) => getHeat(id, cellActivity))
  // col weight = max of cells in that column
  const colWeights = [0, 1, 2].map((c) => Math.max(heats[c], heats[c + 3], heats[c + 6]))
  // row weight = max of cells in that row
  const rowWeights = [0, 1, 2].map((r) => Math.max(heats[r * 3], heats[r * 3 + 1], heats[r * 3 + 2]))
  return {
    cols: colWeights.map((w) => `${w}fr`).join(' '),
    rows: rowWeights.map((w) => `${w}fr`).join(' '),
  }
}

export default function Grid({ cellStates, cellActivity, viewMode, onThemeChange, onActivity }: GridProps): JSX.Element {
  const defaultState = (id: string): CellState => ({
    id, theme: '', pid: null, lastOutput: '', status: 'idle', updatedAt: 0
  })

  if (viewMode === 'command') {
    return (
      <div className="command-layout">
        <div className="command-terminals">
          <div className="grid grid-small">
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

  if (viewMode === 'organism') {
    const { cols, rows } = computeOrganismTemplate(cellActivity)
    return (
      <div
        className="grid"
        style={{
          gridTemplateColumns: cols,
          gridTemplateRows: rows,
          transition: 'grid-template-columns 1.5s ease, grid-template-rows 1.5s ease',
        }}
      >
        {CELL_IDS.map((id) => {
          const heat = getHeat(id, cellActivity)
          return (
            <Cell
              key={id}
              cellState={cellStates[id] || defaultState(id)}
              onThemeChange={onThemeChange}
              onActivity={onActivity}
              heat={heat}
            />
          )
        })}
      </div>
    )
  }

  // default: grid
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
