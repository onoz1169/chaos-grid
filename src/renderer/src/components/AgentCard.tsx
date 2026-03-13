import type { JSX } from 'react'
import type { CellState } from '../../../shared/types'
import type { GenreInfo, FileEntry, ActivityEntry, UncommittedDiff } from '../utils/output-types'
import { STATUS_DOT, STATUS_COLOR } from '../utils/status'

interface AgentCardProps {
  genre: GenreInfo
  cellState: CellState | undefined
  files: FileEntry[]
  stats: { commits: number; latest: ActivityEntry | null } | undefined
  completionSummary: string | undefined
  diffStat: UncommittedDiff | undefined
  isWill: boolean
  roleColor: string
  onClick: () => void
}

export default function AgentCard({
  genre, cellState, files, stats, completionSummary, diffStat, isWill, roleColor: rc, onClick,
}: AgentCardProps): JSX.Element {
  const status = cellState?.status ?? 'idle'
  const latest = stats?.latest
  const ds = diffStat

  return (
    <div
      onClick={onClick}
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
          {genre.name || '\u2014'}
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

      {/* Diff stats */}
      {ds && ds.files.length > 0 && (
        <div style={{
          marginBottom: 6, padding: '4px 8px', borderRadius: 3,
          background: '#0a0a0e', border: '1px solid #1a1a2a',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 8, color: '#668', letterSpacing: 1 }}>CHANGES</span>
          <span style={{ fontSize: 10, color: '#888' }}>{ds.files.length} file{ds.files.length !== 1 ? 's' : ''}</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 10, color: '#6c6', fontVariantNumeric: 'tabular-nums' }}>+{ds.totalInsertions}</span>
          <span style={{ fontSize: 10, color: '#c66', fontVariantNumeric: 'tabular-nums' }}>-{ds.totalDeletions}</span>
        </div>
      )}

      {/* Completion summary */}
      {completionSummary && (
        <div style={{
          marginBottom: 6, padding: '4px 6px', borderRadius: 3,
          background: '#0a100a', border: '1px solid #1a2a1a',
        }}>
          <div style={{ fontSize: 8, color: '#4a4', letterSpacing: 1, marginBottom: 2 }}>COMPLETED</div>
          <div style={{ fontSize: 10, color: '#8c8', lineHeight: 1.4 }}>{completionSummary}</div>
        </div>
      )}

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
}
