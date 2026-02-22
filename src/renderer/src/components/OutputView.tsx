import { useState, useEffect, useCallback, useMemo, type JSX } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { CellState } from '../../../shared/types'
import { getCellIds, getCellRole, roleColor } from '../../../shared/types'

interface FileEntry {
  name: string
  path: string
  modifiedMs: number
  sizeBytes: number
  isDir: boolean
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)}K`
  return `${(bytes / 1_048_576).toFixed(1)}M`
}

function fileExt(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

function extColor(ext: string): string {
  const map: Record<string, string> = {
    ts: '#4488ff', tsx: '#4488ff', js: '#ffcc00', jsx: '#ffcc00',
    py: '#4488bb', rs: '#bb4444', go: '#44bbbb',
    md: '#aaaaaa', json: '#bb8844', yaml: '#bb8844', yml: '#bb8844',
    css: '#bb44bb', html: '#bb6644', sh: '#44bb88', txt: '#888888',
  }
  return map[ext] ?? '#666'
}

interface GenreInfo {
  name: string
  dir: string
  color: string
}

interface OutputViewProps {
  cellStates: Record<string, CellState>
  gridRows: number
  gridCols: number
  outputDir: string
}

export default function OutputView({ cellStates, gridRows, gridCols, outputDir }: OutputViewProps): JSX.Element {
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null)
  const [files, setFiles] = useState<FileEntry[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [loadingContent, setLoadingContent] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)

  // Unique genres from cellStates (deduped by theme/role name)
  const genres = useMemo<GenreInfo[]>(() => {
    const seen = new Set<string>()
    const result: GenreInfo[] = []
    getCellIds(gridRows, gridCols).forEach((id) => {
      const theme = cellStates[id]?.theme
      const role = getCellRole(id, gridCols).toLowerCase()
      const name = (theme || role).toLowerCase()
      if (!seen.has(name)) {
        seen.add(name)
        result.push({
          name,
          dir: `${outputDir.replace(/\/+$/, '')}/${name}`,
          color: roleColor(getCellRole(id, gridCols)),
        })
      }
    })
    return result
  }, [cellStates, gridRows, gridCols, outputDir])

  // Auto-select first genre on load
  useEffect(() => {
    if (genres.length > 0 && selectedGenre === null) {
      setSelectedGenre(genres[0].name)
    }
  }, [genres, selectedGenre])

  const loadFiles = useCallback((genre: GenreInfo) => {
    setLoadingFiles(true)
    setFiles([])
    setSelectedFile(null)
    setFileContent(null)
    setFileError(null)
    invoke<FileEntry[]>('list_dir_files_recursive', { path: genre.dir })
      .then((list) => {
        const sorted = list
          .filter((f) => !f.isDir)
          .sort((a, b) => b.modifiedMs - a.modifiedMs)
        setFiles(sorted)
        setLoadingFiles(false)
        if (sorted.length > 0) setSelectedFile(sorted[0].path)
      })
      .catch(() => {
        setFiles([])
        setLoadingFiles(false)
      })
  }, [])

  // Reload files when genre or outputDir changes
  useEffect(() => {
    const genre = genres.find((g) => g.name === selectedGenre)
    if (genre) loadFiles(genre)
  }, [selectedGenre, genres, loadFiles])

  // Load file content when selection changes
  useEffect(() => {
    if (!selectedFile) { setFileContent(null); setFileError(null); return }
    setLoadingContent(true)
    setFileContent(null)
    setFileError(null)
    invoke<string>('read_file_content', { path: selectedFile })
      .then((c) => { setFileContent(c); setLoadingContent(false) })
      .catch((e) => { setFileError(String(e)); setLoadingContent(false) })
  }, [selectedFile])

  if (!outputDir.trim()) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', fontSize: 13 }}>
        Set an output directory in the toolbar to use this view.
      </div>
    )
  }

  const selectedGenreInfo = genres.find((g) => g.name === selectedGenre)
  const selectedFileName = selectedFile ? selectedFile.split('/').pop() ?? selectedFile : null
  const selectedExt = selectedFileName ? fileExt(selectedFileName) : ''

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: '#0a0a0a' }}>

      {/* Left: Genre list */}
      <div style={{
        width: 160, flexShrink: 0,
        borderRight: '1px solid #1a1a1a',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '7px 10px', fontSize: 9, color: '#444',
          letterSpacing: 1, borderBottom: '1px solid #1a1a1a', flexShrink: 0,
        }}>
          GENRES
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {genres.map((g) => {
            const active = selectedGenre === g.name
            return (
              <div
                key={g.name}
                onClick={() => setSelectedGenre(g.name)}
                style={{
                  padding: '9px 10px',
                  cursor: 'pointer',
                  background: active ? '#161616' : 'transparent',
                  borderLeft: `2px solid ${active ? g.color : 'transparent'}`,
                  display: 'flex', alignItems: 'center', gap: 7,
                  borderBottom: '1px solid #111',
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = '#121212' }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: active ? g.color : '#555',
                  letterSpacing: 0.5,
                }}>
                  {g.name.toUpperCase()}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Center: File list */}
      <div style={{
        width: 220, flexShrink: 0,
        borderRight: '1px solid #1a1a1a',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '7px 10px', fontSize: 9, color: '#444',
          letterSpacing: 1, borderBottom: '1px solid #1a1a1a',
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
        }}>
          <span>FILES</span>
          {files.length > 0 && (
            <span style={{ color: '#333' }}>{files.length}</span>
          )}
        </div>

        {selectedGenreInfo && (
          <div style={{
            padding: '3px 10px', fontSize: 9, color: '#2a2a2a',
            fontFamily: 'monospace', borderBottom: '1px solid #111',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            flexShrink: 0,
          }}>
            {selectedGenreInfo.dir}
          </div>
        )}

        <div style={{ flex: 1, overflow: 'auto' }}>
          {loadingFiles ? (
            <div style={{ padding: '10px', fontSize: 11, color: '#333' }}>Loading...</div>
          ) : files.length === 0 ? (
            <div style={{ padding: '10px', fontSize: 11, color: '#2a2a2a' }}>No files</div>
          ) : files.map((f) => {
            const ext = fileExt(f.name)
            const active = selectedFile === f.path
            return (
              <div
                key={f.path}
                onClick={() => setSelectedFile(f.path)}
                style={{
                  padding: '7px 10px',
                  cursor: 'pointer',
                  background: active ? '#1a1a1a' : 'transparent',
                  borderBottom: '1px solid #111',
                  borderLeft: `2px solid ${active ? (selectedGenreInfo?.color ?? '#444') : 'transparent'}`,
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = '#141414' }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                  <span style={{
                    fontSize: 9, color: extColor(ext), fontWeight: 700,
                    width: 22, textAlign: 'right', flexShrink: 0,
                  }}>
                    {ext || '—'}
                  </span>
                  <span style={{
                    fontSize: 11, color: active ? '#eee' : '#999',
                    flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {f.name}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, paddingLeft: 27 }}>
                  <span style={{ fontSize: 9, color: '#333' }}>{formatSize(f.sizeBytes)}</span>
                  <span style={{ fontSize: 9, color: '#2a2a2a' }}>{timeAgo(f.modifiedMs)}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right: Content preview */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        {/* Preview header */}
        <div style={{
          padding: '7px 14px', fontSize: 9,
          borderBottom: '1px solid #1a1a1a',
          display: 'flex', alignItems: 'center', gap: 8,
          flexShrink: 0, color: '#444', letterSpacing: 1,
        }}>
          {selectedFileName ? (
            <>
              <span style={{ color: extColor(selectedExt), fontWeight: 700 }}>{selectedExt || 'FILE'}</span>
              <span style={{ color: '#666', fontSize: 11 }}>{selectedFileName}</span>
              <span style={{ color: '#2a2a2a', fontFamily: 'monospace', fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedFile}
              </span>
            </>
          ) : (
            <span>PREVIEW</span>
          )}
        </div>

        {/* Content */}
        <div style={{
          flex: 1, overflow: 'auto',
          padding: '14px 18px',
          fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
          fontSize: 12, lineHeight: 1.75,
          color: fileError ? '#ff4444' : '#ccc',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {!selectedFile ? (
            <span style={{ color: '#2a2a2a' }}>← Select a file to preview</span>
          ) : loadingContent ? (
            <span style={{ color: '#333' }}>Loading...</span>
          ) : fileError ? (
            fileError
          ) : (
            fileContent ?? ''
          )}
        </div>
      </div>

    </div>
  )
}
