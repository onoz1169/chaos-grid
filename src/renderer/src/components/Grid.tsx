import type { JSX } from 'react'
import type { CellState } from '../../../shared/types'
import { getCellIds, getColLabels, getCellRole, roleColor } from '../../../shared/types'
import Cell from './Cell'
import SynthesisPanel from './SynthesisPanel'
import OutputView from './OutputView'
import FilesView from './FilesView'

export type ViewMode = 'grid' | 'command' | 'output' | 'files'

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
}

function GridInner({ cellStates, onThemeChange, onActivity, compact, gridRows, gridCols, outputDir }: {
  cellStates: Record<string, CellState>
  onThemeChange: (id: string, theme: string) => void
  onActivity: (id: string) => void
  compact?: boolean
  gridRows: number
  gridCols: number
  outputDir: string
}): JSX.Element {
  const cellIds = getCellIds(gridRows, gridCols)
  const colLabels = getColLabels(gridCols)

  const defaultState = (id: string): CellState => ({
    id, theme: '', pid: null, lastOutput: '', status: 'idle', updatedAt: 0
  })

  return (
    <div className="flow-grid-wrapper">
      <div className="col-headers" style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}>
        {colLabels.map((label, i) => (
          <div key={i} className="col-header" style={{ color: roleColor(label), borderBottom: `1px solid ${roleColor(label)}44` }}>
            {label}
          </div>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}>
        {cellIds.map((id) => {
          const theme = cellStates[id]?.theme
          const role = getCellRole(id, gridCols).toLowerCase()
          const folderName = theme || role
          const workDir = outputDir ? `${outputDir.replace(/\/$/, '')}/${folderName}` : undefined
          return (
            <Cell
              key={id}
              cellState={cellStates[id] || defaultState(id)}
              onThemeChange={onThemeChange}
              onActivity={onActivity}
              compact={compact}
              workDir={workDir}
            />
          )
        })}
      </div>
    </div>
  )
}

export default function Grid({ cellStates, cellActivity, viewMode, onThemeChange, onActivity, language, gridRows, gridCols, outputDir }: GridProps): JSX.Element {
  if (viewMode === 'output') {
    return <OutputView cellStates={cellStates} gridRows={gridRows} gridCols={gridCols} />
  }

  if (viewMode === 'files') {
    return <FilesView cellStates={cellStates} gridRows={gridRows} gridCols={gridCols} outputDir={outputDir} />
  }

  if (viewMode === 'command') {
    return (
      <div className="command-layout">
        <div className="command-terminals">
          <GridInner cellStates={cellStates} onThemeChange={onThemeChange} onActivity={onActivity} compact gridRows={gridRows} gridCols={gridCols} outputDir={outputDir} />
        </div>
        <SynthesisPanel cellStates={cellStates} cellActivity={cellActivity} language={language} cols={gridCols} />
      </div>
    )
  }

  return <GridInner cellStates={cellStates} onThemeChange={onThemeChange} onActivity={onActivity} gridRows={gridRows} gridCols={gridCols} outputDir={outputDir} />
}
