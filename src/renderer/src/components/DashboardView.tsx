import { useMemo, type JSX } from 'react'
import type { CellState } from '../../../shared/types'
import { getColLabels, roleColor } from '../../../shared/types'
import type { GenreInfo, FileEntry, ActivityEntry } from '../utils/output-types'
import { STATUS_DOT, STATUS_COLOR } from '../utils/status'

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
}

export default function DashboardView({
  genres, cellStates, allFiles, activityEntries, loadingActivity,
  summary, summarizing, onSummarize, onRefresh, onSelectGenre, gridCols,
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
        >{summarizing ? 'ANALYZING...' : '⚡ SUMMARIZE'}</button>
      </div>

      {/* Summary text */}
      {summary && (
        <div style={{ padding: '8px 16px', borderBottom: '1px solid #111', background: '#060d06', flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: '#aaa', lineHeight: 1.65 }}>{summary}</span>
        </div>
      )}

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
                {colGenres.map((g) => {
                  const stats = genreStats[g.name]
                  const cs = cellStates[g.cellId]
                  const status = cs?.status ?? 'idle'
                  const files = allFiles[g.name] ?? []
                  const latest = stats?.latest

                  return (
                    <div
                      key={g.name}
                      onClick={() => onSelectGenre(g.name)}
                      style={{
                        background: isWill ? '#050e07' : '#0e0e0e',
                        border: `1px solid ${status === 'idle' ? '#181818' : rc + '55'}`,
                        borderLeft: `3px solid ${STATUS_COLOR[status]}`,
                        borderRadius: 4,
                        padding: '10px 12px',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = isWill ? '#081409' : '#141414' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = isWill ? '#050e07' : '#0e0e0e' }}
                    >
                      {/* Name + status */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: STATUS_COLOR[status] }}>{STATUS_DOT[status]}</span>
                        <span style={{
                          fontSize: 12, fontWeight: 600,
                          color: status === 'idle' ? '#777' : '#ddd',
                          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {g.name || '—'}
                        </span>
                      </div>

                      {/* Metrics */}
                      <div style={{ display: 'flex', gap: 0, marginBottom: 8 }}>
                        <div style={{ flex: 1, textAlign: 'center', borderRight: '1px solid #1a1a1a' }}>
                          <div style={{ fontSize: 20, fontWeight: 700, color: stats?.commits ? rc : '#2a2a2a', lineHeight: 1 }}>
                            {stats?.commits ?? 0}
                          </div>
                          <div style={{ fontSize: 8, color: '#444', letterSpacing: 1, marginTop: 2 }}>COMMITS</div>
                        </div>
                        <div style={{ flex: 1, textAlign: 'center' }}>
                          <div style={{ fontSize: 20, fontWeight: 700, color: files.length ? '#999' : '#2a2a2a', lineHeight: 1 }}>
                            {files.length}
                          </div>
                          <div style={{ fontSize: 8, color: '#444', letterSpacing: 1, marginTop: 2 }}>FILES</div>
                        </div>
                      </div>

                      {/* Latest commit */}
                      <div style={{ borderTop: '1px solid #181818', paddingTop: 6 }}>
                        {latest ? (
                          <>
                            <div style={{
                              fontSize: 10, color: '#777',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                              marginBottom: 2,
                            }}>
                              {latest.message}
                            </div>
                            <div style={{ fontSize: 9, color: '#444' }}>{latest.timeAgo}</div>
                          </>
                        ) : (
                          <div style={{ fontSize: 10, color: '#2a2a2a' }}>no commits yet</div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {colGenres.length === 0 && (
                  <div style={{ padding: '12px', fontSize: 10, color: '#2a2a2a', textAlign: 'center' }}>—</div>
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
