import type { CellState } from '../../../shared/types'
import { CELL_IDS } from '../../../shared/types'
import Cell from './Cell'

interface GridProps {
  cellStates: Record<string, CellState>
  onThemeChange: (id: string, theme: string) => void
}

export default function Grid({ cellStates, onThemeChange }: GridProps): JSX.Element {
  return (
    <div className="grid">
      {CELL_IDS.map((id) => (
        <Cell
          key={id}
          cellState={
            cellStates[id] || { id, theme: '', pid: null, lastOutput: '', status: 'idle', updatedAt: 0 }
          }
          onThemeChange={onThemeChange}
        />
      ))}
    </div>
  )
}
