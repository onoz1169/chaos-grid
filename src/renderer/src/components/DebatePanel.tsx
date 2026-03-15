import { useState, useEffect, useCallback, type JSX } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { CellState } from '../../../shared/types'

// -- Debate types --

interface DebateIssue {
  severity: 'critical' | 'warning' | 'info'
  description: string
  suggestion: string
}

interface CodexReview {
  verdict: 'approve' | 'request_changes' | 'comment'
  issues: DebateIssue[]
  summary: string
  score: number
}

interface DebateResult {
  id: string
  cellId: string
  cellTheme: string
  claudeOutput: string
  review: CodexReview
  timestamp: string
}

// -- Props --

interface DebatePanelProps {
  cellStates: Record<string, CellState>
  gridCols: number
  outputDir: string
}

// -- Helpers --

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#f87171',
  warning: '#facc15',
  info: '#666',
}

const VERDICT_COLOR: Record<string, string> = {
  approve: '#4ade80',
  request_changes: '#facc15',
  comment: '#888',
}

const VERDICT_LABEL: Record<string, string> = {
  approve: 'APPROVE',
  request_changes: 'CHANGES',
  comment: 'COMMENT',
}

function scoreColor(score: number): string {
  if (score > 80) return '#4ade80'
  if (score > 60) return '#facc15'
  return '#f87171'
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      + ' ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' })
  } catch {
    return ts
  }
}

// -- Styles --

const labelStyle: React.CSSProperties = {
  fontSize: 9, color: '#666', letterSpacing: 1,
}

const cellBtnStyle = (active: boolean): React.CSSProperties => ({
  background: active ? '#1a1a1a' : 'none',
  border: `1px solid ${active ? '#333' : '#1a1a1a'}`,
  color: active ? '#ccc' : '#555',
  cursor: 'pointer',
  fontSize: 10,
  padding: '3px 8px',
  borderRadius: 3,
  fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
})

// -- Component --

export default function DebatePanel({ cellStates, gridCols, outputDir }: DebatePanelProps): JSX.Element {
  const [results, setResults] = useState<DebateResult[]>([])
  const [selectedCellId, setSelectedCellId] = useState<string>('')
  const [debating, setDebating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const cellIds = Object.keys(cellStates).sort()

  // Auto-select first cell
  useEffect(() => {
    if (!selectedCellId && cellIds.length > 0) {
      setSelectedCellId(cellIds[0])
    }
  }, [cellIds, selectedCellId])

  // Load history on mount
  const loadHistory = useCallback(() => {
    invoke<DebateResult[]>('get_debate_history')
      .then((list) => setResults(list))
      .catch(() => {})
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  const runDebate = useCallback(() => {
    if (!selectedCellId || debating) return
    setDebating(true)
    setError(null)
    invoke<DebateResult>('run_debate_cmd', {
      cellId: selectedCellId,
      outputDir,
      gridCols,
    })
      .then((result) => {
        setResults((prev) => [result, ...prev])
        setDebating(false)
      })
      .catch((e) => {
        setError(String(e))
        setDebating(false)
      })
  }, [selectedCellId, debating, outputDir, gridCols])

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return (
    <div style={{
      flex: 1, overflow: 'auto', padding: '12px 16px',
      fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div>
          <span style={{ fontSize: 12, color: '#ccc', letterSpacing: 2 }}>DEBATE</span>
          <span style={{ fontSize: 9, color: '#555', marginLeft: 8 }}>
            {results.length} review{results.length !== 1 ? 's' : ''}
          </span>
        </div>
        <span style={{ flex: 1 }} />
        <button
          onClick={runDebate}
          disabled={debating || !selectedCellId}
          style={{
            background: debating ? '#0a0a1a' : '#0d1020',
            border: `1px solid ${debating ? '#1a2a3a' : '#55bbff'}`,
            color: debating ? '#3a5a7a' : '#55bbff',
            cursor: debating ? 'default' : 'pointer',
            fontSize: 9, padding: '3px 12px', borderRadius: 3, letterSpacing: 1,
          }}
        >
          {debating ? 'REVIEWING...' : 'REVIEW'}
        </button>
      </div>

      {/* Cell selector */}
      <div>
        <div style={labelStyle}>SELECT CELL</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
          {cellIds.map((id) => {
            const theme = cellStates[id]?.theme
            return (
              <button
                key={id}
                onClick={() => setSelectedCellId(id)}
                style={cellBtnStyle(selectedCellId === id)}
              >
                {id}{theme ? ` [${theme}]` : ''}
              </button>
            )
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '6px 10px', background: '#1a0a0a', border: '1px solid #3a1a1a',
          borderRadius: 3, fontSize: 10, color: '#f87171',
        }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {debating && (
        <div style={{ fontSize: 11, color: '#55bbff', padding: '8px 0' }}>
          Running code review...
        </div>
      )}

      {/* Empty state */}
      {results.length === 0 && !debating && (
        <div style={{ fontSize: 11, color: '#444', padding: '20px 0', textAlign: 'center' }}>
          No reviews yet. Select a cell and click Review.
        </div>
      )}

      {/* Results list */}
      {results.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {results.map((r) => {
            const expanded = expandedIds.has(r.id)
            const vc = VERDICT_COLOR[r.review.verdict] ?? '#888'
            const sc = scoreColor(r.review.score)
            const issueCount = r.review.issues.length

            return (
              <div
                key={r.id}
                style={{
                  background: '#0d0d0d', border: '1px solid #1a1a1a',
                  borderRadius: 3, padding: '8px 10px',
                }}
              >
                {/* Result header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 10, color: '#aaa' }}>{r.cellTheme || r.cellId}</span>
                  <span style={{ fontSize: 9, color: '#444' }}>{formatTimestamp(r.timestamp)}</span>
                  <span style={{ flex: 1 }} />
                  <span style={{
                    fontSize: 8, letterSpacing: 1, padding: '1px 6px',
                    borderRadius: 2, border: `1px solid ${vc}44`,
                    color: vc, background: `${vc}11`,
                  }}>
                    {VERDICT_LABEL[r.review.verdict] ?? r.review.verdict.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: sc }}>
                    {r.review.score}
                  </span>
                </div>

                {/* Summary */}
                <div style={{ fontSize: 10, color: '#888', marginTop: 6, lineHeight: 1.5 }}>
                  {r.review.summary}
                </div>

                {/* Issues toggle */}
                {issueCount > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <button
                      onClick={() => toggleExpanded(r.id)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 9, color: '#555', padding: 0, letterSpacing: 1,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#888' }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#555' }}
                    >
                      {expanded ? 'HIDE' : 'SHOW'} {issueCount} ISSUE{issueCount !== 1 ? 'S' : ''}
                    </button>

                    {expanded && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
                        {r.review.issues.map((issue, idx) => {
                          const sevColor = SEVERITY_COLOR[issue.severity] ?? '#666'
                          return (
                            <div
                              key={idx}
                              style={{
                                padding: '5px 8px', background: '#080808',
                                borderLeft: `2px solid ${sevColor}`,
                                borderRadius: 2,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{
                                  fontSize: 8, color: sevColor, letterSpacing: 1,
                                  textTransform: 'uppercase',
                                }}>
                                  {issue.severity}
                                </span>
                              </div>
                              <div style={{ fontSize: 10, color: '#aaa', marginTop: 3, lineHeight: 1.5 }}>
                                {issue.description}
                              </div>
                              {issue.suggestion && (
                                <div style={{ fontSize: 9, color: '#666', marginTop: 3, lineHeight: 1.4 }}>
                                  Suggestion: {issue.suggestion}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
