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

  useEffect(() => {
    const interval = setInterval(analyze, 3 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const now = Date.now()
  const hotCells = Object.entries(cellActivity)
    .filter(([, t]) => now - t < 30000)
    .map(([id]) => cellStates[id]?.theme || id)

  return (
    <div className="synthesis-panel">
      <div className="synthesis-header">
        <span className="synthesis-title">司令塔</span>
        <button className="btn btn-green" onClick={analyze} disabled={analyzing}
          style={{ fontSize: 11, padding: '2px 8px' }}>
          {analyzing ? '分析中...' : '⟳ 分析'}
        </button>
      </div>

      {/* Active now */}
      {hotCells.length > 0 && (
        <div className="synthesis-section">
          <div className="synthesis-label">アクティブ</div>
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
          <div className="synthesis-label">流れの分析</div>

          <div className="flow-block">
            <div className="flow-layer-label" style={{ color: '#4488bb' }}>刺激 → 意志</div>
            <div className="flow-text">{result.flow.stimuli_to_will}</div>
          </div>

          <div className="flow-block">
            <div className="flow-layer-label" style={{ color: '#bb8844' }}>意志 → 供給</div>
            <div className="flow-text">{result.flow.will_to_supply}</div>
          </div>

          {result.flow.stuck !== '詰まりなし' && (
            <div className="flow-block stuck">
              <div className="flow-layer-label" style={{ color: '#ff4444' }}>詰まり</div>
              <div className="flow-text">{result.flow.stuck}</div>
            </div>
          )}

          <div className="flow-block next">
            <div className="flow-layer-label" style={{ color: '#00ff88' }}>次のアクション</div>
            <div className="flow-text">{result.flow.next}</div>
          </div>
        </div>
      )}

      {/* Cell summaries */}
      {result && Object.keys(result.summaries).length > 0 && (
        <div className="synthesis-section">
          <div className="synthesis-label">各セル</div>
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
          <div className="synthesis-label">発見・アイデア</div>
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
          刺激・意志・供給の<br />各セルを動かしたら<br />「分析」を押す。<br /><br />
          流れの詰まりと<br />次のアクションが<br />見えてくる。
        </div>
      )}

      {lastAnalyzed && (
        <div className="synthesis-footer">
          {lastAnalyzed.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} 分析
        </div>
      )}
    </div>
  )
}
