import { useState, useEffect, type JSX } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { CellState, AnalyzeResult } from '../../../shared/types'

interface SynthesisPanelProps {
  cellStates: Record<string, CellState>
  cellActivity: Record<string, number>
  language: string
}

export default function SynthesisPanel({ cellStates, cellActivity, language }: SynthesisPanelProps): JSX.Element {
  const [result, setResult] = useState<AnalyzeResult | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [lastAnalyzed, setLastAnalyzed] = useState<Date | null>(null)

  const analyze = async (): Promise<void> => {
    setAnalyzing(true)
    try {
      const r = await invoke<AnalyzeResult>('analyze', { language })
      setResult(r)
      setLastAnalyzed(new Date())
    } finally {
      setAnalyzing(false)
    }
  }

  useEffect(() => {
    const interval = setInterval(analyze, 3 * 60 * 1000)
    return () => clearInterval(interval)
  }, [language])

  const now = Date.now()
  const hotCells = Object.entries(cellActivity)
    .filter(([, t]) => now - t < 30000)
    .map(([id]) => cellStates[id]?.theme || id)

  return (
    <div className="synthesis-panel">
      <div className="synthesis-header">
        <span className="synthesis-title">Command</span>
        <button className="btn btn-green" onClick={analyze} disabled={analyzing}
          style={{ fontSize: 11, padding: '2px 8px' }}>
          {analyzing ? 'Analyzing...' : '⟳ Analyze'}
        </button>
      </div>

      {/* Active now */}
      {hotCells.length > 0 && (
        <div className="synthesis-section">
          <div className="synthesis-label">Active</div>
          {hotCells.map((theme) => (
            <div key={theme} className="activity-row hot">
              <span className="activity-dot" />{theme}
            </div>
          ))}
        </div>
      )}

      {/* Flow analysis */}
      {result?.flow && (
        <div className="synthesis-section">
          <div className="synthesis-label">Flow Analysis</div>

          <div className="flow-block">
            <div className="flow-layer-label" style={{ color: '#4488bb' }}>Stimulus → Will</div>
            <div className="flow-text">{result.flow.stimuli_to_will}</div>
          </div>

          <div className="flow-block">
            <div className="flow-layer-label" style={{ color: '#bb8844' }}>Will → Supply</div>
            <div className="flow-text">{result.flow.will_to_supply}</div>
          </div>

          {result.flow.stuck.toLowerCase() !== 'none' && (
            <div className="flow-block stuck">
              <div className="flow-layer-label" style={{ color: '#ff4444' }}>Blocked</div>
              <div className="flow-text">{result.flow.stuck}</div>
            </div>
          )}

          <div className="flow-block next">
            <div className="flow-layer-label" style={{ color: '#00ff88' }}>Next Action</div>
            <div className="flow-text">{result.flow.next}</div>
          </div>
        </div>
      )}

      {/* Cell summaries */}
      {result && Object.keys(result.summaries).length > 0 && (
        <div className="synthesis-section">
          <div className="synthesis-label">Cells</div>
          {Object.entries(result.summaries).map(([cellId, summary]) => (
            <div key={cellId} className="summary-row">
              <span className="summary-theme">{cellStates[cellId]?.theme || cellId}</span>
              <span className="summary-text">{summary}</span>
            </div>
          ))}
        </div>
      )}

      {/* Cross-theme ideas */}
      {result && result.ideas.length > 0 && (
        <div className="synthesis-section">
          <div className="synthesis-label">Ideas</div>
          {result.ideas.map((idea, i) => (
            <div key={i} className="idea-row">
              <span className="idea-bullet">✦</span>
              <span>{idea}</span>
            </div>
          ))}
        </div>
      )}

      {!result && (
        <div style={{ color: '#333', fontSize: 11, padding: '16px 14px', lineHeight: 2 }}>
          Run terminals in each<br />Stimulus / Will / Supply<br />cell, then press Analyze.<br /><br />
          Discover where the flow<br />is blocked and what<br />to do next.
        </div>
      )}

      {lastAnalyzed && (
        <div className="synthesis-footer">
          {lastAnalyzed.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} analyzed
        </div>
      )}
    </div>
  )
}
