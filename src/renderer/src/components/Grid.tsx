import { useState, useRef, useEffect, useCallback, Fragment, type JSX } from 'react'
import type { CellState } from '../../../shared/types'
import { getCellIds, getColLabels, roleColor, cellWorkDir } from '../../../shared/types'
import { useLocalStorage } from '../hooks/useLocalStorage'
import Cell from './Cell'
import ControlView from './OutputView'

export type ViewMode = 'grid' | 'control'

function startDrag(
  e: React.MouseEvent,
  direction: 'h' | 'v',
  onDelta: (delta: number) => void
) {
  e.preventDefault()
  let last = direction === 'h' ? e.clientX : e.clientY
  const move = (ev: MouseEvent) => {
    const cur = direction === 'h' ? ev.clientX : ev.clientY
    onDelta(cur - last)
    last = cur
  }
  const up = () => {
    document.removeEventListener('mousemove', move)
    document.removeEventListener('mouseup', up)
  }
  document.addEventListener('mousemove', move)
  document.addEventListener('mouseup', up)
}

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
  onGridChange: (rows: number, cols: number) => void
  hiddenCells: string[]
  onHideCell: (id: string) => void
  resetKey: number
}

function GridInner({
  cellStates, onThemeChange, onActivity, compact, gridRows, gridCols,
  outputDir, toolCmd, hiddenCells, onHideCell, resetKey,
}: {
  cellStates: Record<string, CellState>
  onThemeChange: (id: string, theme: string) => void
  onActivity: (id: string) => void
  compact?: boolean
  gridRows: number
  gridCols: number
  outputDir: string
  toolCmd: string
  hiddenCells: string[]
  onHideCell: (id: string) => void
  resetKey: number
}): JSX.Element {
  const cellIds = getCellIds(gridRows, gridCols)
  const colLabels = getColLabels(gridCols)

  const defaultCellState = (id: string): CellState => ({
    id, theme: '', pid: null, lastOutput: '', status: 'idle', updatedAt: 0
  })

  // flex-grow values for columns and cells (persisted to localStorage)
  const [colSizes, setColSizes] = useLocalStorage<number[]>('chaos-grid-col-sizes', Array(gridCols).fill(1))
  const [cellSizes, setCellSizes] = useLocalStorage<Record<string, number>>('chaos-grid-cell-sizes', {})

  // Stable refs for use inside drag closures
  const colSizesRef = useRef(colSizes)
  colSizesRef.current = colSizes
  const cellSizesRef = useRef(cellSizes)
  cellSizesRef.current = cellSizes
  const hiddenCellsRef = useRef(hiddenCells)
  hiddenCellsRef.current = hiddenCells
  const gridRowsRef = useRef(gridRows)
  gridRowsRef.current = gridRows
  const gridColsRef = useRef(gridCols)
  gridColsRef.current = gridCols

  // Reset all sizes when resetKey changes
  useEffect(() => {
    setColSizes(Array(gridCols).fill(1))
    setCellSizes({})
  }, [resetKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync colSizes length when gridCols changes
  useEffect(() => {
    setColSizes(prev =>
      prev.length === gridCols
        ? prev
        : Array.from({ length: gridCols }, (_, i) => prev[i] ?? 1)
    )
  }, [gridCols])

  const containerRef = useRef<HTMLDivElement>(null)
  const colContainerRefs = useRef<(HTMLDivElement | null)[]>([])

  // Drag: column width resize
  const startColResize = useCallback((colIndex: number) => (e: React.MouseEvent) => {
    startDrag(e, 'h', (delta) => {
      if (!containerRef.current) return
      const w = containerRef.current.getBoundingClientRect().width
      const sizes = colSizesRef.current
      const total = sizes.reduce((s, v) => s + v, 0)
      const d = (delta / w) * total
      setColSizes(prev => {
        const next = [...prev]
        next[colIndex] = Math.max(0.1, next[colIndex] + d)
        next[colIndex + 1] = Math.max(0.1, next[colIndex + 1] - d)
        return next
      })
    })
  }, [])

  // Drag: cell height resize
  const startCellResize = useCallback(
    (colIndex: number, aboveId: string, belowId: string) => (e: React.MouseEvent) => {
      startDrag(e, 'v', (delta) => {
        const colEl = colContainerRefs.current[colIndex]
        if (!colEl) return
        const h = colEl.getBoundingClientRect().height
        const rows = gridRowsRef.current
        const cols = gridColsRef.current
        const colCellIds = getCellIds(rows, cols).filter(
          id => parseInt(id.replace('cell-', '')) % cols === colIndex
               && !hiddenCellsRef.current.includes(id)
        )
        const sizes = cellSizesRef.current
        const totalFlex = colCellIds.reduce((s, id) => s + (sizes[id] ?? 1), 0)
        const d = (delta / h) * totalFlex
        setCellSizes(prev => {
          const next = { ...prev }
          next[aboveId] = Math.max(0.1, (next[aboveId] ?? 1) + d)
          next[belowId] = Math.max(0.1, (next[belowId] ?? 1) - d)
          return next
        })
      })
    },
    []
  )

  return (
    <div className="flow-grid-wrapper">
      {/* Columns with drag resize handles */}
      <div ref={containerRef} style={{ flex: 1, display: 'flex', overflow: 'hidden', background: '#111' }}>
        {Array.from({ length: gridCols }, (_, colIndex) => {
          const label = colLabels[colIndex]
          const isWill = label === 'Will'
          const colCellIds = cellIds.filter(
            id => parseInt(id.replace('cell-', '')) % gridCols === colIndex
                 && !hiddenCells.includes(id)
          )

          return (
            <Fragment key={colIndex}>
              {/* Column */}
              <div style={{
                flexGrow: colSizes[colIndex] ?? 1,
                flexShrink: 1,
                flexBasis: 0,
                display: 'flex',
                flexDirection: 'column',
                background: isWill ? '#050f07' : '#0a0a0a',
                overflow: 'hidden',
                minWidth: 80,
              }}>
                {/* Column header */}
                <div className="col-header" style={{
                  color: roleColor(label),
                  borderBottom: `2px solid ${roleColor(label)}${isWill ? '88' : '55'}`,
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: 4,
                  background: isWill ? '#050f07' : '#080808',
                  flexShrink: 0,
                }}>
                  {label}
                </div>

                {/* Cells container */}
                <div
                  ref={el => { colContainerRefs.current[colIndex] = el }}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
                >
                  {colCellIds.length === 0 ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#222', fontSize: 11, letterSpacing: 2 }}>
                      EMPTY
                    </div>
                  ) : colCellIds.map((id, cellIndex) => (
                    <Fragment key={id}>
                      {/* Cell wrapper with flex-grow for height resize */}
                      <div style={{
                        flexGrow: cellSizes[id] ?? 1,
                        flexShrink: 1,
                        flexBasis: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        minHeight: 60,
                      }}>
                        <Cell
                          cellState={cellStates[id] || defaultCellState(id)}
                          onThemeChange={onThemeChange}
                          onActivity={onActivity}
                          compact={compact}
                          workDir={outputDir ? cellWorkDir(id, cellStates[id], outputDir, gridCols) : undefined}
                          toolCmd={toolCmd}
                          onClose={() => onHideCell(id)}
                        />
                      </div>

                      {/* Horizontal drag handle between cells */}
                      {cellIndex < colCellIds.length - 1 && (
                        <div
                          style={{ height: 4, flexShrink: 0, cursor: 'row-resize', background: '#1a1a1a' }}
                          onMouseDown={startCellResize(colIndex, id, colCellIds[cellIndex + 1])}
                          onMouseEnter={e => { e.currentTarget.style.background = '#3a3a3a' }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#1a1a1a' }}
                        />
                      )}
                    </Fragment>
                  ))}
                </div>
              </div>

              {/* Vertical drag handle between columns */}
              {colIndex < gridCols - 1 && (
                <div
                  style={{ width: 4, flexShrink: 0, cursor: 'col-resize', background: '#111' }}
                  onMouseDown={startColResize(colIndex)}
                  onMouseEnter={e => { e.currentTarget.style.background = '#2a2a2a' }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#111' }}
                />
              )}
            </Fragment>
          )
        })}
      </div>

    </div>
  )
}

export default function Grid({
  cellStates, cellActivity: _cellActivity, viewMode, onThemeChange, onActivity,
  language: _language, gridRows, gridCols, outputDir, toolCmd, onGridChange: _onGridChange,
  hiddenCells, onHideCell, resetKey,
}: GridProps): JSX.Element {
  return (
    <>
      {/* display:flex+flex:1 ensures proper height when visible; display:none preserves PTY sessions */}
      <div style={{
        display: viewMode === 'grid' ? 'flex' : 'none',
        flex: 1,
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <GridInner
          cellStates={cellStates}
          onThemeChange={onThemeChange}
          onActivity={onActivity}
          gridRows={gridRows}
          gridCols={gridCols}
          outputDir={outputDir}
          toolCmd={toolCmd}
          hiddenCells={hiddenCells}
          onHideCell={onHideCell}
          resetKey={resetKey}
        />
      </div>
      {viewMode === 'control' && (
        <ControlView cellStates={cellStates} gridRows={gridRows} gridCols={gridCols} outputDir={outputDir} />
      )}
    </>
  )
}
