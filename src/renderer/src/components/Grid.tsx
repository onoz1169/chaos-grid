import type { JSX } from 'react'
import type { CellState } from '../../../shared/types'
import { getCellIds, getColLabels, getCellRole, roleColor, cellWorkDir } from '../../../shared/types'
import Cell from './Cell'
import ControlView from './OutputView'

export type ViewMode = 'grid' | 'control'

interface GridProps {
  cellStates: Record<string, CellState>
  cellActivity: Record<string, number>
  viewMode: ViewMode
  onThemeChange: (id: string, theme: string) => void
  onActivity: (id: string) => void
  language: string
  gridRows: number
  gridCols: number
  outputDir: string
  toolCmd: string
}

function GridInner({ cellStates, onThemeChange, onActivity, compact, gridRows, gridCols, outputDir, toolCmd }: {
  cellStates: Record<string, CellState>
  onThemeChange: (id: string, theme: string) => void
  onActivity: (id: string) => void
  compact?: boolean
  gridRows: number
  gridCols: number
  outputDir: string
  toolCmd: string
}): JSX.Element {
  const cellIds = getCellIds(gridRows, gridCols)
  const colLabels = getColLabels(gridCols)

  const defaultState = (id: string): CellState => ({
    id, theme: '', pid: null, lastOutput: '', status: 'idle', updatedAt: 0
  })

  return (
    <div className="flow-grid-wrapper">
      <div className="col-headers" style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}>
        {colLabels.map((label, i) => {
          const isWill = label === 'Will'
          return (
            <div key={i} className="col-header" style={{
              color: roleColor(label),
              borderBottom: `2px solid ${roleColor(label)}${isWill ? '88' : '33'}`,
              fontSize: isWill ? 14 : 11,
              fontWeight: isWill ? 700 : 600,
              letterSpacing: isWill ? 4 : 3,
              background: isWill ? '#050f07' : undefined,
            }}>
              {label}
            </div>
          )
        })}
      </div>

      <div className="grid" style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}>
        {cellIds.map((id) => {
          const workDir = outputDir ? cellWorkDir(id, cellStates[id], outputDir, gridCols) : undefined
          return (
            <Cell
              key={id}
              cellState={cellStates[id] || defaultState(id)}
              onThemeChange={onThemeChange}
              onActivity={onActivity}
              compact={compact}
              workDir={workDir}
              toolCmd={toolCmd}
            />
          )
        })}
      </div>
    </div>
  )
}

export default function Grid({ cellStates, cellActivity: _cellActivity, viewMode, onThemeChange, onActivity, language: _language, gridRows, gridCols, outputDir, toolCmd }: GridProps): JSX.Element {
  // Keep GridInner mounted during control view to preserve terminal sessions.
  // Use display:none instead of unmounting to prevent spawn_pty from resetting the shell.
  return (
    <>
      <div style={{ display: viewMode === 'grid' ? undefined : 'none' }}>
        <GridInner cellStates={cellStates} onThemeChange={onThemeChange} onActivity={onActivity} gridRows={gridRows} gridCols={gridCols} outputDir={outputDir} toolCmd={toolCmd} />
      </div>
      {viewMode === 'control' && <ControlView cellStates={cellStates} gridRows={gridRows} gridCols={gridCols} outputDir={outputDir} />}
    </>
  )
}
