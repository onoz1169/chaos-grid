import { useState, useEffect, useCallback, type JSX } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { CellState, GridPreset } from '../../shared/types'
import { getCellIds, cellWorkDir } from '../../shared/types'
import { useLocalStorage } from './hooks/useLocalStorage'
import TopBar, { type CliTool, TOOL_COMMANDS } from './components/TopBar'
import Grid, { type ViewMode } from './components/Grid'
import SessionRestoreDialog from './components/SessionRestoreDialog'

export default function App(): JSX.Element {
  const [cellStates, setCellStates] = useState<Record<string, CellState>>({})
  const [cellActivity, setCellActivity] = useState<Record<string, number>>({})
  const [resetKey, setResetKey] = useState(0)
  const [showRestoreDialog, setShowRestoreDialog] = useState(true)

  const [viewMode, setViewMode] = useLocalStorage<ViewMode>('chaos-grid-view', 'grid')
  const [language, setLanguage] = useLocalStorage('chaos-grid-language', 'Japanese')
  const [gridRows, setGridRows] = useLocalStorage('chaos-grid-rows', 2, Number)
  const [gridCols, setGridCols] = useLocalStorage('chaos-grid-cols', 3, Number)
  const [outputDir, setOutputDir] = useLocalStorage('chaos-grid-output-dir', '~/chaos-grid-output')
  const [cliTool, setCliTool] = useLocalStorage<CliTool>('chaos-grid-cli-tool', 'claude')
  const [customCmd, setCustomCmd] = useLocalStorage('chaos-grid-custom-cmd', '')
  const [hiddenCells, setHiddenCells] = useLocalStorage<string[]>('chaos-grid-hidden-cells', [])
  const [presets, setPresets] = useLocalStorage<GridPreset[]>('chaos-grid-presets', [])
  const [focusedCellId, setFocusedCellId] = useState<string | null>(null)
  const [worktreeEnabled, setWorktreeEnabled] = useLocalStorage<boolean>('chaos-grid-worktree-enabled', false)
  const [worktreeRepoPath, setWorktreeRepoPath] = useLocalStorage('chaos-grid-worktree-repo', '')

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

  const handleSavePreset = useCallback((name: string) => {
    const preset: GridPreset = { name, gridRows, gridCols, outputDir, cliTool, customCmd }
    setPresets((prev) => {
      const existing = prev.findIndex((p) => p.name === name)
      if (existing >= 0) {
        const next = [...prev]
        next[existing] = preset
        return next
      }
      return [...prev, preset]
    })
  }, [gridRows, gridCols, outputDir, cliTool, customCmd, setPresets])

  const handleLoadPreset = useCallback((name: string) => {
    const preset = presets.find((p) => p.name === name)
    if (!preset) return
    setGridRows(preset.gridRows)
    setGridCols(preset.gridCols)
    setOutputDir(preset.outputDir)
    setCliTool(preset.cliTool as CliTool)
    setCustomCmd(preset.customCmd)
  }, [presets, setGridRows, setGridCols, setOutputDir, setCliTool, setCustomCmd])

  const handleDeletePreset = useCallback((name: string) => {
    setPresets((prev) => prev.filter((p) => p.name !== name))
  }, [setPresets])

  const handleBroadcast = useCallback(async (data: string) => {
    const activeCellIds = getCellIds(gridRows, gridCols)
      .filter(id => !hiddenCells.includes(id) && cellStates[id]?.pid)
    for (const cellId of activeCellIds) {
      await invoke('write_pty', { cellId, data })
    }
  }, [gridRows, gridCols, hiddenCells, cellStates])

  const handleLaunchAll = useCallback(async () => {
    const cellIds = getCellIds(gridRows, gridCols).filter((id) => !hiddenCells.includes(id))
    const workDirs = cellIds.map((id) => cellWorkDir(id, cellStates[id], outputDir, gridCols))

    // Worktree setup if enabled
    if (worktreeEnabled && worktreeRepoPath) {
      for (let i = 0; i < cellIds.length; i++) {
        const id = cellIds[i]
        const wDir = workDirs[i]
        const theme = cellStates[id]?.theme ?? ''
        const branchName = `chaos/${id}${theme ? '-' + theme.replace(/\s+/g, '-').toLowerCase() : ''}`
        try {
          await invoke('setup_worktree', { repoPath: worktreeRepoPath, worktreePath: wDir, branchName })
        } catch (e) {
          console.error(`Worktree setup failed for ${id}:`, e)
        }
      }
    }

    await invoke('launch_cells', { cellIds, workDirs, toolCmd: resolvedToolCmd })
  }, [gridRows, gridCols, outputDir, cellStates, resolvedToolCmd, hiddenCells, worktreeEnabled, worktreeRepoPath])

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
      if (mod && !e.shiftKey && e.key >= '1' && e.key <= '9') {
        e.preventDefault()
        setFocusedCellId(`cell-${parseInt(e.key) - 1}`)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleLaunchAll, handleResetAll, setViewMode])

  const handleThemeChange = useCallback((id: string, theme: string) => {
    invoke('set_theme', { cellId: id, theme })
    setCellStates((prev) => ({ ...prev, [id]: { ...prev[id], theme } }))
  }, [])

  // Save session whenever active cells change
  useEffect(() => {
    const entries = Object.values(cellStates)
      .filter((c) => c.pid)
      .map((c) => ({
        cellId: c.id,
        workDir: cellWorkDir(c.id, c, outputDir, gridCols),
        toolCmd: resolvedToolCmd,
      }))
    if (entries.length > 0) {
      invoke('save_session_state', { entries }).catch(() => {})
    }
  }, [cellStates, outputDir, gridCols, resolvedToolCmd])

  const handleRestoreSession = useCallback(async (entries: Array<{ cellId: string; workDir: string; toolCmd: string }>) => {
    setShowRestoreDialog(false)
    for (const entry of entries) {
      await invoke('launch_cell', {
        cellId: entry.cellId,
        workDir: entry.workDir || null,
        toolCmd: entry.toolCmd || null,
      })
    }
  }, [])

  const activeCells = Object.values(cellActivity).filter(
    (t) => Date.now() - t < 120_000
  ).length

  return (
    <>
      {showRestoreDialog && (
        <SessionRestoreDialog
          onRestore={handleRestoreSession}
          onDismiss={() => setShowRestoreDialog(false)}
        />
      )}
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
        presets={presets}
        onSavePreset={handleSavePreset}
        onLoadPreset={handleLoadPreset}
        onDeletePreset={handleDeletePreset}
        onBroadcast={handleBroadcast}
        worktreeEnabled={worktreeEnabled}
        onWorktreeEnabledChange={setWorktreeEnabled}
        worktreeRepoPath={worktreeRepoPath}
        onWorktreeRepoPathChange={setWorktreeRepoPath}
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
        focusedCellId={focusedCellId}
      />
    </>
  )
}
