import { useState, useEffect } from 'react'
import type { CellState, AnalyzeResult } from '../../../shared/types'

interface SynthesisPanelProps {
  cellStates: Record<string, CellState>
  cellActivity: Record<string, number>
}

export default function SynthesisPanel({ cellStates, cellActivity }: SynthesisPanelProps): JSX.Element {
  const [result, setResult] = useState<AnalyzeResult | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [lastAnalyzed, setLastAnalyzed] = useState<Date | null>(null)

  const analyze = async (): Promise<void> => {
    setAnalyzing(true)
    try {
      const r = (await window.chaosAPI.invoke('chaos:analyze')) as AnalyzeResult
      setResult(r)
      setLastAnalyzed(new Date())
    } finally {
      setAnalyzing(false)
    }
  }

  // Auto-refresh every 3 minutes
  useEffect(() => {
    const interval = setInterval(analyze, 3 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const now = Date.now()
  const hotCells = Object.entries(cellActivity)
    .filter(([, t]) => now - t < 30000)
    .map(([id]) => cellStates[id]?.theme || id)

  const warmCells = Object.entries(cellActivity)
    .filter(([, t]) => now - t >= 30000 && now - t < 120000)
    .map(([id]) => cellStates[id]?.theme || id)

  return (
    <div className="synthesis-panel">
      <div className="synthesis-header">
        <span className="synthesis-title">CHAOS BRAIN</span>
        <button
          className="btn btn-green"
          onClick={analyze}
          disabled={analyzing}
          style={{ fontSize: 11, padding: '2px 8px' }}
        >
          {analyzing ? '...' : '⟳ ANALYZE'}
        </button>
      </div>

      {/* Live activity */}
      <div className="synthesis-section">
        <div className="synthesis-label">LIVE</div>
        {hotCells.length > 0 ? (
          hotCells.map((theme) => (
            <div key={theme} className="activity-row hot">
              <span className="activity-dot" />
              <span>{theme}</span>
            </div>
          ))
        ) : (
          <div style={{ color: '#444', fontSize: 11 }}>no active terminals</div>
        )}
        {warmCells.map((theme) => (
          <div key={theme} className="activity-row warm">
            <span className="activity-dot warm" />
            <span>{theme}</span>
          </div>
        ))}
      </div>

      {/* AI Summaries */}
      {result && Object.keys(result.summaries).length > 0 && (
        <div className="synthesis-section">
          <div className="synthesis-label">WHAT'S HAPPENING</div>
          {Object.entries(result.summaries).map(([cellId, summary]) => {
            const theme = cellStates[cellId]?.theme || cellId
            return (
              <div key={cellId} className="summary-row">
                <span className="summary-theme">{theme}</span>
                <span className="summary-text">{summary}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Cross-theme ideas */}
      {result && result.ideas.length > 0 && (
        <div className="synthesis-section">
          <div className="synthesis-label">NEW CONNECTIONS</div>
          {result.ideas.slice(0, 3).map((idea, i) => (
            <div key={i} className="idea-row">
              <span className="idea-bullet">✦</span>
              <span>{idea}</span>
            </div>
          ))}
        </div>
      )}

      {!result && (
        <div style={{ color: '#333', fontSize: 11, marginTop: 16, lineHeight: 1.8 }}>
          Run some terminals,<br />
          then hit ANALYZE.<br />
          <br />
          Cross-theme ideas<br />
          will appear here.
        </div>
      )}

      {lastAnalyzed && (
        <div className="synthesis-footer">
          analyzed {lastAnalyzed.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
    </div>
  )
}
