import { useState, useEffect, useCallback, useRef, type JSX } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { CellState, AnalyzeResult } from '../../shared/types'
import TopBar from './components/TopBar'
import Grid, { type ViewMode } from './components/Grid'
import StatusOverlay from './components/StatusOverlay'

type AutoTimer = 'off' | '1' | '3' | '5' | '10'

export default function App(): JSX.Element {
  const [cellStates, setCellStates] = useState<Record<string, CellState>>({})
  const [cellActivity, setCellActivity] = useState<Record<string, number>>({})
  const [showStatus, setShowStatus] = useState(false)
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResult | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [autoTimer, setAutoTimer] = useState<AutoTimer>('off')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [language, setLanguage] = useState<string>(
    () => localStorage.getItem('chaos-grid-language') ?? 'English'
  )
  const [gridRows, setGridRows] = useState<number>(
    () => parseInt(localStorage.getItem('chaos-grid-rows') ?? '3', 10)
  )
  const [gridCols, setGridCols] = useState<number>(
    () => parseInt(localStorage.getItem('chaos-grid-cols') ?? '3', 10)
  )
  const [outputDir, setOutputDir] = useState<string>(
    () => localStorage.getItem('chaos-grid-output-dir') ?? ''
  )

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

  const handleLanguageChange = useCallback((lang: string) => {
    setLanguage(lang)
    localStorage.setItem('chaos-grid-language', lang)
  }, [])

  const handleGridChange = useCallback((rows: number, cols: number) => {
    setGridRows(rows)
    setGridCols(cols)
    localStorage.setItem('chaos-grid-rows', String(rows))
    localStorage.setItem('chaos-grid-cols', String(cols))
  }, [])

  const handleOutputDirChange = useCallback((dir: string) => {
    setOutputDir(dir)
    localStorage.setItem('chaos-grid-output-dir', dir)
  }, [])

  const handleAnalyze = useCallback(async () => {
    setAnalyzing(true)
    try {
      const result = await invoke<AnalyzeResult>('analyze', { language, cols: gridCols })
      setAnalyzeResult(result)
      setShowStatus(true)
    } finally {
      setAnalyzing(false)
    }
  }, [language, gridCols])

  const autoTimerRef = useRef(autoTimer)
  autoTimerRef.current = autoTimer
  useEffect(() => {
    if (autoTimer === 'off') return
    const ms = parseInt(autoTimer) * 60 * 1000
    const interval = setInterval(() => handleAnalyze(), ms)
    return () => clearInterval(interval)
  }, [autoTimer, handleAnalyze])

  const handleLaunchAll = useCallback(async () => {
    const cellIds = Array.from({ length: gridRows * gridCols }, (_, i) => `cell-${i}`)
    await invoke('launch_cells', { cellIds, outputDir: outputDir || null })
  }, [gridRows, gridCols, outputDir])

  const handleThemeChange = useCallback((id: string, theme: string) => {
    invoke('set_theme', { cellId: id, theme })
    setCellStates((prev) => ({ ...prev, [id]: { ...prev[id], theme } }))
  }, [])

  const totalCells = gridRows * gridCols
  const activeCells = Object.values(cellActivity).filter(
    (t) => Date.now() - t < 120_000
  ).length

  return (
    <>
      <TopBar
        activeCells={activeCells}
        totalCells={totalCells}
        analyzing={analyzing}
        autoTimer={autoTimer}
        onAutoTimerChange={setAutoTimer}
        onAnalyze={handleAnalyze}
        onLaunchAll={handleLaunchAll}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        language={language}
        onLanguageChange={handleLanguageChange}
        gridRows={gridRows}
        gridCols={gridCols}
        onGridChange={handleGridChange}
        outputDir={outputDir}
        onOutputDirChange={handleOutputDirChange}
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
      />
      {showStatus && analyzeResult && (
        <StatusOverlay
          result={analyzeResult}
          cellStates={cellStates}
          onClose={() => setShowStatus(false)}
        />
      )}
    </>
  )
}
