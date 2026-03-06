import { useState, useEffect, useCallback, type JSX } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { GenreInfo, GitInfo } from '../utils/output-types'

interface GitPanelProps {
  selectedGenre: GenreInfo | undefined
  gitInfo: GitInfo | null
  loading: boolean
  onRefresh: () => void
}

function DiffView({ lines }: { lines: string[] }): JSX.Element {
  return (
    <div style={{
      fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
      fontSize: 11, lineHeight: 1.5, overflow: 'auto',
      background: '#080808', padding: '8px 0',
      borderTop: '1px solid #1a1a1a', maxHeight: 400,
    }}>
      {lines.slice(0, 600).map((line, i) => {
        let color = '#888'
        let bg = 'transparent'
        if (line.startsWith('+') && !line.startsWith('+++')) { color = '#4ade80'; bg = '#0a1f0a' }
        else if (line.startsWith('-') && !line.startsWith('---')) { color = '#f87171'; bg = '#1f0a0a' }
        else if (line.startsWith('@@')) { color = '#60a5fa'; bg = '#0a0f1f' }
        else if (line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('---') || line.startsWith('+++')) { color = '#666' }
        else if (line.startsWith('commit ') || line.startsWith('Author:') || line.startsWith('Date:')) { color = '#aaa' }
        return (
          <div key={i} style={{ background: bg, color, padding: '0 12px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {line || ' '}
          </div>
        )
      })}
      {lines.length > 600 && (
        <div style={{ color: '#444', padding: '4px 12px', fontSize: 10 }}>… {lines.length - 600} more lines</div>
      )}
    </div>
  )
}

function getGithubUrl(remoteUrl: string): string | null {
  // Convert git remote URL to GitHub web URL
  // https://github.com/user/repo.git  → https://github.com/user/repo
  // git@github.com:user/repo.git      → https://github.com/user/repo
  const httpsMatch = remoteUrl.match(/^https?:\/\/github\.com\/(.+?)(?:\.git)?$/)
  if (httpsMatch) return `https://github.com/${httpsMatch[1]}`
  const sshMatch = remoteUrl.match(/^git@github\.com:(.+?)(?:\.git)?$/)
  if (sshMatch) return `https://github.com/${sshMatch[1]}`
  return null
}

export default function GitPanel({ selectedGenre, gitInfo, loading, onRefresh }: GitPanelProps): JSX.Element {
  const [selectedHash, setSelectedHash] = useState<string | null>(null)
  const [diffContent, setDiffContent] = useState<string | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null)

  // Load remote URL by reading .git/config
  useEffect(() => {
    if (!selectedGenre) { setRemoteUrl(null); return }
    const gitConfigPath = `${selectedGenre.dir}/.git/config`
    invoke<string>('read_file_content', { path: gitConfigPath })
      .then((content) => {
        // Parse [remote "origin"] url = ...
        const match = content.match(/\[remote\s+"origin"\][^\[]*url\s*=\s*(.+)/s)
        const urlLine = match ? match[1].split('\n')[0].trim() : null
        setRemoteUrl(urlLine)
      })
      .catch(() => setRemoteUrl(null))
  }, [selectedGenre?.name])

  // Reset diff when genre changes
  useEffect(() => {
    setSelectedHash(null)
    setDiffContent(null)
  }, [selectedGenre?.name])

  const loadDiff = useCallback((hash: string) => {
    if (!selectedGenre) return
    if (selectedHash === hash) { setSelectedHash(null); setDiffContent(null); return }
    setSelectedHash(hash)
    setDiffContent(null)
    setDiffLoading(true)
    invoke<string>('get_git_diff', { path: selectedGenre.dir, hash })
      .then((d) => { setDiffContent(d); setDiffLoading(false) })
      .catch(() => { setDiffContent('Failed to load diff.'); setDiffLoading(false) })
  }, [selectedGenre, selectedHash])

  if (!selectedGenre) {
    return <div style={{ padding: 20, color: '#555', fontSize: 12 }}>Select a genre to view git status.</div>
  }

  if (loading && !gitInfo) {
    return <div style={{ padding: 20, color: '#555', fontSize: 12 }}>Loading...</div>
  }

  if (!gitInfo || !gitInfo.isGitRepo) {
    return (
      <div style={{ padding: 20, color: '#555', fontSize: 12 }}>
        <div style={{ color: '#444', fontSize: 11 }}>{selectedGenre.dir}</div>
        <div style={{ marginTop: 8 }}>Not a git repository.</div>
      </div>
    )
  }

  const color = selectedGenre.color
  const hasChanges = gitInfo.staged.length > 0 || gitInfo.unstaged.length > 0

  return (
    <div style={{ flex: 1, overflow: 'auto', fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace' }}>
      {/* Header */}
      <div style={{
        padding: '10px 16px', borderBottom: '1px solid #1a1a1a',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 10, color: '#555' }}>branch</span>
        <span style={{ fontSize: 13, color, fontWeight: 700 }}>{gitInfo.branch || 'HEAD'}</span>
        <span style={{ flex: 1 }} />
        {remoteUrl && getGithubUrl(remoteUrl) && (
          <button
            onClick={() => { const url = getGithubUrl(remoteUrl); if (url) window.open(url, '_blank') }}
            style={{ background: 'none', border: '1px solid #222', color: '#555', cursor: 'pointer', fontSize: 9, padding: '2px 7px', borderRadius: 3 }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = '#aaa' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.color = '#555' }}
          >↗ GITHUB</button>
        )}
        <button
          onClick={onRefresh}
          style={{ background: 'none', border: '1px solid #222', color: '#555', cursor: 'pointer', fontSize: 9, padding: '2px 7px', borderRadius: 3 }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = '#aaa' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.color = '#555' }}
        >⟳ REFRESH</button>
      </div>

      {/* Uncommitted changes */}
      {hasChanges && (
        <div style={{ padding: '10px 16px', borderBottom: '1px solid #1a1a1a' }}>
          <div style={{ fontSize: 9, color: '#666', letterSpacing: 1, marginBottom: 6 }}>UNCOMMITTED CHANGES</div>
          {gitInfo.staged.map((f, i) => (
            <div key={`s-${i}`} style={{ display: 'flex', gap: 8, marginBottom: 2 }}>
              <span style={{ fontSize: 10, color: '#00cc66', width: 10, flexShrink: 0 }}>{f[0]}</span>
              <span style={{ fontSize: 11, color: '#aaa' }}>{f.slice(2)}</span>
            </div>
          ))}
          {gitInfo.unstaged.map((f, i) => (
            <div key={`u-${i}`} style={{ display: 'flex', gap: 8, marginBottom: 2 }}>
              <span style={{ fontSize: 10, color: f[0] === '?' ? '#555' : '#ff8844', width: 10, flexShrink: 0 }}>{f[0]}</span>
              <span style={{ fontSize: 11, color: f[0] === '?' ? '#666' : '#bbb' }}>{f.slice(2)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Commit log */}
      <div style={{ padding: '10px 16px' }}>
        <div style={{ fontSize: 9, color: '#666', letterSpacing: 1, marginBottom: 8 }}>
          COMMITS {gitInfo.commits.length > 0 ? `(${gitInfo.commits.length})` : ''}
          <span style={{ color: '#444', marginLeft: 6, fontWeight: 400 }}>— click to see diff</span>
        </div>
        {gitInfo.commits.length === 0 ? (
          <div style={{ fontSize: 11, color: '#444' }}>No commits yet.</div>
        ) : gitInfo.commits.map((c, i) => {
          const isSelected = selectedHash === c.hash
          return (
            <div key={c.hash}>
              <div
                onClick={() => loadDiff(c.hash)}
                style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                  paddingBottom: 8, marginBottom: isSelected ? 0 : 8,
                  borderBottom: !isSelected && i < gitInfo.commits.length - 1 ? '1px solid #111' : 'none',
                  cursor: 'pointer',
                  background: isSelected ? '#0d0d0d' : 'transparent',
                  padding: '6px 4px',
                  borderRadius: 3,
                  marginLeft: -4, marginRight: -4,
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#0d0d0d' }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 3, flexShrink: 0 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: i === 0 ? color : (isSelected ? color : '#333'), flexShrink: 0 }} />
                  {i < gitInfo.commits.length - 1 && (
                    <div style={{ width: 1, height: 16, background: '#1e1e1e', marginTop: 2 }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: i === 0 ? '#e0e0e0' : '#999', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.message}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                    <span style={{ fontSize: 9, color: '#555', fontFamily: 'monospace' }}>{c.hash}</span>
                    <span style={{ fontSize: 9, color: '#444' }}>{c.timeAgo}</span>
                  </div>
                </div>
                <span style={{ fontSize: 9, color: isSelected ? color : '#444', flexShrink: 0, alignSelf: 'center' }}>
                  {isSelected ? '▲' : '▼'}
                </span>
              </div>

              {isSelected && (
                <div style={{ marginBottom: 8, borderBottom: '1px solid #111' }}>
                  {diffLoading ? (
                    <div style={{ padding: '8px 12px', color: '#555', fontSize: 11 }}>Loading diff...</div>
                  ) : diffContent ? (
                    <DiffView lines={diffContent.split('\n')} />
                  ) : null}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
