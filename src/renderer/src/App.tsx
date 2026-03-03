import { useState, useEffect, useCallback, type JSX } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { CellState } from '../../shared/types'
import { getCellIds, cellWorkDir } from '../../shared/types'
import { useLocalStorage } from './hooks/useLocalStorage'
import TopBar, { type CliTool, TOOL_COMMANDS } from './components/TopBar'
import Grid, { type ViewMode } from './components/Grid'

export default function App(): JSX.Element {
  const [cellStates, setCellStates] = useState<Record<string, CellState>>({})
  const [cellActivity, setCellActivity] = useState<Record<string, number>>({})
  const [resetKey, setResetKey] = useState(0)

  const [viewMode, setViewMode] = useLocalStorage<ViewMode>('chaos-grid-view', 'grid')
  const [language, setLanguage] = useLocalStorage('chaos-grid-language', 'Japanese')
  const [gridRows, setGridRows] = useLocalStorage('chaos-grid-rows', 2, Number)
  const [gridCols, setGridCols] = useLocalStorage('chaos-grid-cols', 3, Number)
  const [outputDir, setOutputDir] = useLocalStorage('chaos-grid-output-dir', '~/chaos-grid-output')
  const [cliTool, setCliTool] = useLocalStorage<CliTool>('chaos-grid-cli-tool', 'claude')
  const [customCmd, setCustomCmd] = useLocalStorage('chaos-grid-custom-cmd', '')
  const [hiddenCells, setHiddenCells] = useLocalStorage<string[]>('chaos-grid-hidden-cells', [])

  const resolvedToolCmd = cliTool === 'custom' ? customCmd : TOOL_COMMANDS[cliTool]

  useEffect(() => {
    invoke<CellState[]>('get_cells').then((arr) => {
      const map: Record<string, CellState> = {}
      arr.forEach((c) => (map[c.id] = c))
      setCellStates(map)
    })
  }, [])

  const handleActivity = useCallback((id: string) => {
    setCellActivity((prev) => ({ ...prev, [id]: Date.now() }))
  }, [])

  const handleGridChange = useCallback((rows: number, cols: number) => {
    setGridRows(rows)
    setGridCols(cols)
  }, [setGridRows, setGridCols])

  const handleHideCell = useCallback((id: string) => {
    setHiddenCells((prev) => prev.includes(id) ? prev : [...prev, id])
  }, [setHiddenCells])

  const handleResetAll = useCallback(async () => {
    await invoke('kill_all_ptys')
    setHiddenCells([])
    setResetKey(k => k + 1)
  }, [setHiddenCells])

  const handleLaunchAll = useCallback(async () => {
    const cellIds = getCellIds(gridRows, gridCols).filter((id) => !hiddenCells.includes(id))
    const workDirs = cellIds.map((id) => cellWorkDir(id, cellStates[id], outputDir, gridCols))
    await invoke('launch_cells', { cellIds, workDirs, toolCmd: resolvedToolCmd })
  }, [gridRows, gridCols, outputDir, cellStates, resolvedToolCmd, hiddenCells])

  // Keyboard shortcuts: Cmd/Ctrl+Shift+L/R/G/C
  useEffect(() => {
    const isMac = navigator.platform.toUpperCase().includes('MAC')
    const handler = (e: KeyboardEvent) => {
      const mod = isMac ? e.metaKey : e.ctrlKey
      if (mod && e.shiftKey) {
        switch (e.key.toLowerCase()) {
          case 'l': e.preventDefault(); handleLaunchAll(); break
          case 'r': e.preventDefault(); handleResetAll(); break
          case 'g': e.preventDefault(); setViewMode('grid'); break
          case 'c': e.preventDefault(); setViewMode('control'); break
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleLaunchAll, handleResetAll, setViewMode])

  const handleThemeChange = useCallback((id: string, theme: string) => {
    invoke('set_theme', { cellId: id, theme })
    setCellStates((prev) => ({ ...prev, [id]: { ...prev[id], theme } }))
  }, [])

  const activeCells = Object.values(cellActivity).filter(
    (t) => Date.now() - t < 120_000
  ).length

  return (
    <>
      <TopBar
        activeCells={activeCells}
        totalCells={gridRows * gridCols}
        onLaunchAll={handleLaunchAll}
        onResetAll={handleResetAll}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        language={language}
        onLanguageChange={setLanguage}
        gridRows={gridRows}
        gridCols={gridCols}
        onGridChange={handleGridChange}
        outputDir={outputDir}
        onOutputDirChange={setOutputDir}
        cliTool={cliTool}
        onCliToolChange={setCliTool}
        customCmd={customCmd}
        onCustomCmdChange={setCustomCmd}
      />
      <Grid
        cellStates={cellStates}
        cellActivity={cellActivity}
        viewMode={viewMode}
        onThemeChange={handleThemeChange}
        onActivity={handleActivity}
        language={language}
        gridRows={gridRows}
        gridCols={gridCols}
        outputDir={outputDir}
        toolCmd={resolvedToolCmd}
        onGridChange={handleGridChange}
        hiddenCells={hiddenCells}
        onHideCell={handleHideCell}
        resetKey={resetKey}
      />
    </>
  )
}
