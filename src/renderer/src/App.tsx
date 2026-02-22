import { useState, useEffect, useCallback, useRef } from 'react'
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

  useEffect(() => {
    window.chaosAPI.invoke('chaos:get-cells').then((cells) => {
      const arr = cells as CellState[]
      const map: Record<string, CellState> = {}
      arr.forEach((c) => (map[c.id] = c))
      setCellStates(map)
    })
  }, [])

  const handleActivity = useCallback((id: string) => {
    setCellActivity((prev) => ({ ...prev, [id]: Date.now() }))
  }, [])

  const handleAnalyze = useCallback(async () => {
    setAnalyzing(true)
    try {
      const result = (await window.chaosAPI.invoke('chaos:analyze')) as AnalyzeResult
      setAnalyzeResult(result)
      setShowStatus(true)
    } finally {
      setAnalyzing(false)
    }
  }, [])

  const autoTimerRef = useRef(autoTimer)
  autoTimerRef.current = autoTimer
  useEffect(() => {
    if (autoTimer === 'off') return
    const ms = parseInt(autoTimer) * 60 * 1000
    const interval = setInterval(() => handleAnalyze(), ms)
    return () => clearInterval(interval)
  }, [autoTimer, handleAnalyze])

  const handleLaunchAll = useCallback(async () => {
    await window.chaosAPI.invoke('chaos:launch-all')
  }, [])

  const handleThemeChange = useCallback((id: string, theme: string) => {
    window.chaosAPI.invoke('chaos:set-theme', id, theme)
    setCellStates((prev) => ({ ...prev, [id]: { ...prev[id], theme } }))
  }, [])

  const activeCells = Object.values(cellActivity).filter(
    (t) => Date.now() - t < 120_000
  ).length

  return (
    <>
      <TopBar
        activeCells={activeCells}
        analyzing={analyzing}
        autoTimer={autoTimer}
        onAutoTimerChange={setAutoTimer}
        onAnalyze={handleAnalyze}
        onLaunchAll={handleLaunchAll}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
      />
      <Grid
        cellStates={cellStates}
        cellActivity={cellActivity}
        viewMode={viewMode}
        onThemeChange={handleThemeChange}
        onActivity={handleActivity}
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
