import { useState, useEffect, useCallback, type JSX } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { GenreInfo, UncommittedDiff } from '../utils/output-types'
import { roleColor } from '../../../shared/types'

interface DiffTabProps {
  genres: GenreInfo[]
}

const MAX_DIFF_LINES = 800

function DiffLine({ line }: { line: string }): JSX.Element {
  let color = '#888'
  let bg = 'transparent'
  if (line.startsWith('+++') || line.startsWith('---')) {
    color = '#888'
  } else if (line.startsWith('+')) {
    color = '#6c6'
    bg = '#0a1a0a'
  } else if (line.startsWith('-')) {
    color = '#c66'
    bg = '#1a0a0a'
  } else if (line.startsWith('@@')) {
    color = '#68c'
    bg = '#0a0a1a'
  } else if (line.startsWith('diff ')) {
    color = '#aaa'
    bg = '#111'
  }
  return (
    <div style={{ color, background: bg, padding: '0 8px', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
      {line}
    </div>
  )
}

export default function DiffTab({ genres }: DiffTabProps): JSX.Element {
  const [diffs, setDiffs] = useState<Record<string, UncommittedDiff>>({})
  const [loading, setLoading] = useState(false)
  const [expandedGenre, setExpandedGenre] = useState<string | null>(null)

  const loadDiffs = useCallback(() => {
    if (genres.length === 0) return
    setLoading(true)
    Promise.all(
      genres.map((g) =>
        invoke<UncommittedDiff>('get_uncommitted_diff', { path: g.dir })
          .then((d) => ({ name: g.name, diff: d }))
          .catch(() => ({ name: g.name, diff: { files: [], diffText: '', totalInsertions: 0, totalDeletions: 0 } as UncommittedDiff }))
      )
    ).then((results) => {
      const map: Record<string, UncommittedDiff> = {}
      results.forEach((r) => { map[r.name] = r.diff })
      setDiffs(map)
      setLoading(false)
    })
  }, [genres])

  useEffect(() => { loadDiffs() }, [loadDiffs])

  // Auto-refresh every 15s
  useEffect(() => {
    if (genres.length === 0) return
    const iv = setInterval(loadDiffs, 15_000)
    return () => clearInterval(iv)
  }, [genres, loadDiffs])

  const totalIns = Object.values(diffs).reduce((s, d) => s + d.totalInsertions, 0)
  const totalDel = Object.values(diffs).reduce((s, d) => s + d.totalDeletions, 0)
  const totalFiles = Object.values(diffs).reduce((s, d) => s + d.files.length, 0)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0a0a0a' }}>
      {/* Header */}
      <div style={{
        padding: '8px 16px', borderBottom: '1px solid #1a1a1a', background: '#080808',
        display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, color: '#888' }}>
          {totalFiles} changed file{totalFiles !== 1 ? 's' : ''}
        </span>
        {(totalIns > 0 || totalDel > 0) && (
          <>
            <span style={{ fontSize: 11, color: '#6c6', fontVariantNumeric: 'tabular-nums' }}>+{totalIns}</span>
            <span style={{ fontSize: 11, color: '#c66', fontVariantNumeric: 'tabular-nums' }}>-{totalDel}</span>
          </>
        )}
        <span style={{ flex: 1 }} />
        <button
          onClick={loadDiffs}
          disabled={loading}
          style={{
            background: 'none', border: '1px solid #1a1a1a', color: loading ? '#333' : '#555',
            cursor: loading ? 'default' : 'pointer', fontSize: 9, padding: '3px 9px', borderRadius: 3,
          }}
        >{loading ? '...' : 'REFRESH'}</button>
      </div>

      {/* Genre diff cards */}
      <div style={{ flex: 1, overflow: 'auto', padding: 10 }}>
        {genres.map((g) => {
          const d = diffs[g.name]
          if (!d || d.files.length === 0) return null
          const rc = roleColor(g.role)
          const isExpanded = expandedGenre === g.name

          return (
            <div key={g.name} style={{ marginBottom: 8 }}>
              {/* Card header */}
              <div
                onClick={() => setExpandedGenre(isExpanded ? null : g.name)}
                style={{
                  padding: '8px 12px', background: '#0e0e0e',
                  border: `1px solid #1a1a1a`, borderLeft: `3px solid ${rc}`,
                  borderRadius: isExpanded ? '4px 4px 0 0' : 4,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#141414' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#0e0e0e' }}
              >
                <span style={{ fontSize: 10, color: '#555' }}>{isExpanded ? '▼' : '▶'}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: rc, flex: 1 }}>{g.name || g.cellId}</span>
                <span style={{ fontSize: 10, color: '#666' }}>{d.files.length} file{d.files.length !== 1 ? 's' : ''}</span>
                <span style={{ fontSize: 10, color: '#6c6', fontVariantNumeric: 'tabular-nums' }}>+{d.totalInsertions}</span>
                <span style={{ fontSize: 10, color: '#c66', fontVariantNumeric: 'tabular-nums' }}>-{d.totalDeletions}</span>
              </div>

              {/* File list (always visible) */}
              <div style={{
                background: '#0c0c0c', borderLeft: `3px solid ${rc}33`,
                borderRight: '1px solid #1a1a1a',
                borderBottom: isExpanded ? 'none' : '1px solid #1a1a1a',
                borderRadius: isExpanded ? 0 : '0 0 4px 4px',
                padding: '4px 0',
              }}>
                {d.files.map((f) => (
                  <div key={f.name} style={{
                    padding: '2px 16px', display: 'flex', gap: 8, alignItems: 'center',
                    fontSize: 11, fontFamily: 'monospace',
                  }}>
                    <span style={{ color: '#777', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.name}
                    </span>
                    {f.insertions > 0 && <span style={{ color: '#6c6', fontSize: 10 }}>+{f.insertions}</span>}
                    {f.deletions > 0 && <span style={{ color: '#c66', fontSize: 10 }}>-{f.deletions}</span>}
                  </div>
                ))}
              </div>

              {/* Expanded diff */}
              {isExpanded && d.diffText && (
                <div style={{
                  background: '#080808',
                  border: '1px solid #1a1a1a', borderTop: 'none',
                  borderLeft: `3px solid ${rc}33`,
                  borderRadius: '0 0 4px 4px',
                  maxHeight: 500, overflow: 'auto',
                  fontSize: 11, fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
                }}>
                  {d.diffText.split('\n').slice(0, MAX_DIFF_LINES).map((line, i) => (
                    <DiffLine key={i} line={line} />
                  ))}
                  {d.diffText.split('\n').length > MAX_DIFF_LINES && (
                    <div style={{ padding: '4px 8px', color: '#444', fontSize: 10 }}>
                      ... {d.diffText.split('\n').length - MAX_DIFF_LINES} more lines
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* No changes state */}
        {!loading && Object.values(diffs).every((d) => d.files.length === 0) && (
          <div style={{ textAlign: 'center', color: '#333', fontSize: 12, paddingTop: 40 }}>
            No uncommitted changes
          </div>
        )}
      </div>
    </div>
  )
}
