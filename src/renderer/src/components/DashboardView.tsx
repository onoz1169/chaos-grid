import { useMemo, useState, useEffect, useCallback, type JSX } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { CellState } from '../../../shared/types'
import { getColLabels, roleColor } from '../../../shared/types'
import type { GenreInfo, FileEntry, ActivityEntry, AnalyzeResult, UncommittedDiff } from '../utils/output-types'
import { STATUS_DOT, STATUS_COLOR } from '../utils/status'
import FlowAnalysisPanel from './FlowAnalysisPanel'
import AgentCard from './AgentCard'

interface DashboardViewProps {
  genres: GenreInfo[]
  cellStates: Record<string, CellState>
  allFiles: Record<string, FileEntry[]>
  activityEntries: ActivityEntry[]
  loadingActivity: boolean
  summary: string
  summarizing: boolean
  onSummarize: () => void
  onRefresh: () => void
  onSelectGenre: (name: string) => void
  gridCols: number
  analyzeResult: AnalyzeResult | null
  analyzing: boolean
  onAnalyze: () => void
  cellSummaries: Record<string, string>
}

export default function DashboardView({
  genres, cellStates, allFiles, activityEntries, loadingActivity,
  summary, summarizing, onSummarize, onRefresh, onSelectGenre, gridCols,
  analyzeResult, analyzing, onAnalyze,
  cellSummaries,
}: DashboardViewProps): JSX.Element {
  const colLabels = getColLabels(gridCols)

  // Per-genre aggregation
  const genreStats = useMemo(() => {
    const stats: Record<string, { commits: number; latest: ActivityEntry | null }> = {}
    genres.forEach((g) => { stats[g.name] = { commits: 0, latest: null } })
    activityEntries.forEach((e) => {
      if (stats[e.genre]) {
        stats[e.genre].commits++
        if (!stats[e.genre].latest) stats[e.genre].latest = e
      }
    })
    return stats
  }, [genres, activityEntries])

  // Load diff stats for each genre
  const [diffStats, setDiffStats] = useState<Record<string, UncommittedDiff>>({})

  const loadDiffStats = useCallback(() => {
    genres.forEach((g) => {
      invoke<UncommittedDiff>('get_uncommitted_diff', { path: g.dir })
        .then((d) => setDiffStats((prev) => ({ ...prev, [g.name]: d })))
        .catch(() => {})
    })
  }, [genres])

  useEffect(() => { loadDiffStats() }, [loadDiffStats])
  useEffect(() => {
    if (genres.length === 0) return
    const iv = setInterval(loadDiffStats, 15_000)
    return () => clearInterval(iv)
  }, [genres, loadDiffStats])

  const totalCommits = activityEntries.length
  const totalFiles = genres.reduce((s, g) => s + (allFiles[g.name]?.length ?? 0), 0)
  const running = Object.values(cellStates).filter((c) => c.status !== 'idle').length

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0a0a0a' }}>

      {/* Global header */}
      <div style={{
        padding: '8px 16px', borderBottom: '1px solid #1a1a1a',
        display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
        background: '#080808',
      }}>
        <span style={{ fontSize: 11, color: running > 0 ? '#00ff88' : '#444' }}>
          {STATUS_DOT[running > 0 ? 'active' : 'idle']} {running} running
        </span>
        <span style={{ fontSize: 11, color: '#666' }}>{totalCommits} commits</span>
        <span style={{ fontSize: 11, color: '#555' }}>{totalFiles} files</span>
        <span style={{ flex: 1 }} />
        <button
          onClick={onRefresh}
          style={{ background: 'none', border: '1px solid #1a1a1a', color: '#555', cursor: 'pointer', fontSize: 9, padding: '3px 9px', borderRadius: 3 }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#888' }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1a1a1a'; e.currentTarget.style.color = '#555' }}
        >⟳</button>
        <button
          onClick={onSummarize}
          disabled={summarizing}
          style={{
            background: summarizing ? '#0a1a0a' : '#001a0d',
            border: `1px solid ${summarizing ? '#1a3a1a' : '#00ff88'}`,
            color: summarizing ? '#3a6a3a' : '#00ff88',
            cursor: summarizing ? 'default' : 'pointer',
            fontSize: 9, padding: '3px 12px', borderRadius: 3, letterSpacing: 1,
          }}
        >{summarizing ? 'SUMMARIZING...' : 'SUMMARIZE'}</button>
        <button
          onClick={onAnalyze}
          disabled={analyzing}
          style={{
            background: analyzing ? '#0a0a1a' : '#001020',
            border: `1px solid ${analyzing ? '#1a2a3a' : '#55bbff'}`,
            color: analyzing ? '#3a5a7a' : '#55bbff',
            cursor: analyzing ? 'default' : 'pointer',
            fontSize: 9, padding: '3px 12px', borderRadius: 3, letterSpacing: 1,
          }}
        >{analyzing ? 'ANALYZING...' : 'ANALYZE FLOW'}</button>
      </div>

      {/* Summary text */}
      {summary && (
        <div style={{ padding: '8px 16px', borderBottom: '1px solid #111', background: '#060d06', flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: '#aaa', lineHeight: 1.65 }}>{summary}</span>
        </div>
      )}

      {/* Flow analysis */}
      {analyzeResult?.flow && <FlowAnalysisPanel analyzeResult={analyzeResult} />}

      {/* Agent card grid */}
      <div style={{ flex: 1, overflow: 'auto', padding: '10px' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          {colLabels.map((roleLabel) => {
            const rc = roleColor(roleLabel)
            const isWill = roleLabel === 'Will'
            const colGenres = genres.filter((g) => g.role === roleLabel)
            const colCommits = colGenres.reduce((s, g) => s + (genreStats[g.name]?.commits ?? 0), 0)
            const colFiles = colGenres.reduce((s, g) => s + (allFiles[g.name]?.length ?? 0), 0)

            return (
              <div key={roleLabel} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* Column header */}
                <div style={{
                  padding: '6px 10px',
                  borderBottom: `2px solid ${rc}${isWill ? '88' : '44'}`,
                  background: isWill ? '#040d06' : '#0a0a0a',
                  display: 'flex', alignItems: 'baseline', gap: 8,
                }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: rc, letterSpacing: 3 }}>
                    {roleLabel.toUpperCase()}
                  </span>
                  <span style={{ fontSize: 9, color: '#555' }}>{colCommits}c · {colFiles}f</span>
                </div>

                {/* Agent cards */}
                {colGenres.map((g) => (
                  <AgentCard
                    key={g.name}
                    genre={g}
                    cellState={cellStates[g.cellId]}
                    files={allFiles[g.name] ?? []}
                    stats={genreStats[g.name]}
                    completionSummary={cellSummaries[g.cellId]}
                    diffStat={diffStats[g.name]}
                    isWill={isWill}
                    roleColor={rc}
                    onClick={() => onSelectGenre(g.name)}
                  />
                ))}

                {colGenres.length === 0 && (
                  <div style={{ padding: '12px', fontSize: 10, color: '#2a2a2a', textAlign: 'center' }}>{'\u2014'}</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Mini activity feed */}
      {(activityEntries.length > 0 || loadingActivity) && (
        <div style={{ borderTop: '1px solid #141414', background: '#080808', maxHeight: 148, overflow: 'auto', flexShrink: 0 }}>
          {loadingActivity && activityEntries.length === 0 ? (
            <div style={{ padding: '8px 16px', fontSize: 10, color: '#333' }}>Loading...</div>
          ) : (
            <>
              <div style={{ padding: '5px 16px 2px', fontSize: 8, color: '#333', letterSpacing: 2 }}>RECENT COMMITS</div>
              {activityEntries.slice(0, 8).map((e, i) => {
                const color = genres.find((g) => g.name === e.genre)?.color ?? '#555'
                return (
                  <div key={`${e.hash}-${i}`} style={{
                    padding: '3px 16px', display: 'flex', gap: 10, alignItems: 'center',
                    borderBottom: '1px solid #0c0c0c',
                  }}>
                    <span style={{ color: '#444', width: 36, flexShrink: 0, textAlign: 'right', fontSize: 9 }}>{e.timeAgo}</span>
                    <span style={{ color, fontSize: 9, width: 72, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      [{e.genre}]
                    </span>
                    <span style={{ color: '#888', flex: 1, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.message}
                    </span>
                    <span style={{ color: '#333', fontSize: 9, fontFamily: 'monospace', flexShrink: 0 }}>{e.hash}</span>
                  </div>
                )
              })}
            </>
          )}
        </div>
      )}
    </div>
  )
}
