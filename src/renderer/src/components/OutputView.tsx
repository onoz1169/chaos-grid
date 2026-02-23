import { useState, useEffect, useCallback, useMemo, useRef, type JSX } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { CellState } from '../../../shared/types'
import { getCellIds, getCellRole, roleColor, cellWorkDir } from '../../../shared/types'
import { fileExt, extColor, timeAgo, formatSize } from '../utils/files'

interface FileEntry {
  name: string
  path: string
  modifiedMs: number
  sizeBytes: number
  isDir: boolean
}

interface GenreInfo {
  name: string
  dir: string
  color: string
}

// ---- Summary bar ----

interface SummaryBarProps {
  genres: GenreInfo[]
  allFiles: Record<string, FileEntry[]>
  summary: string
  summarizing: boolean
  loading: boolean
  selected: string | null
  onSelect: (name: string) => void
  onRefresh: () => void
}

function SummaryBar({ genres, allFiles, summary, summarizing, loading, selected, onSelect, onRefresh }: SummaryBarProps): JSX.Element {
  return (
    <div style={{
      flexShrink: 0,
      borderBottom: '1px solid #1a1a1a',
      background: '#0a0a0a',
    }}>
      {/* Unified LLM summary */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid #141414',
        display: 'flex', alignItems: 'flex-start', gap: 10,
        minHeight: 44,
      }}>
        <div style={{ flex: 1 }}>
          {summarizing ? (
            <span style={{ fontSize: 11, color: '#666' }}>Summarizing...</span>
          ) : summary ? (
            <span style={{ fontSize: 12, color: '#ccc', lineHeight: 1.6 }}>{summary}</span>
          ) : (
            <span style={{ fontSize: 11, color: '#555' }}>No output yet</span>
          )}
        </div>
        <button
          onClick={onRefresh}
          style={{
            background: 'none', border: 'none', color: '#666', cursor: 'pointer',
            fontSize: 14, padding: '0 2px', flexShrink: 0,
            opacity: loading || summarizing ? 0.3 : 1,
          }}
          title="Refresh"
        >
          ⟳
        </button>
      </div>

      {/* Genre cards — metadata only */}
      <div style={{ display: 'flex', gap: 0, overflowX: 'auto' }}>
        {genres.map((g) => {
          const files = allFiles[g.name] ?? []
          const recent = files.slice(0, 3)
          const lastModified = files[0]?.modifiedMs
          const active = selected === g.name
          const totalSize = files.reduce((s, f) => s + f.sizeBytes, 0)

          return (
            <div
              key={g.name}
              onClick={() => onSelect(g.name)}
              style={{
                flex: 1, minWidth: 160,
                padding: '8px 12px',
                borderRight: '1px solid #141414',
                borderBottom: `2px solid ${active ? g.color : 'transparent'}`,
                cursor: 'pointer',
                background: active ? '#111' : 'transparent',
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = '#0d0d0d' }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
            >
              {/* Genre header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: g.color, letterSpacing: 0.5 }}>
                  {g.name.toUpperCase()}
                </span>
                <span style={{ fontSize: 9, color: '#888' }}>
                  {files.length > 0 ? `${files.length} file${files.length > 1 ? 's' : ''}` : 'no files'}
                </span>
                {totalSize > 0 && (
                  <span style={{ fontSize: 9, color: '#777' }}>{formatSize(totalSize)}</span>
                )}
                {lastModified && (
                  <span style={{ fontSize: 9, color: '#777', marginLeft: 'auto' }}>{timeAgo(lastModified)}</span>
                )}
              </div>

              {/* Recent files */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {recent.map((f) => {
                  const ext = fileExt(f.name)
                  return (
                    <div key={f.path} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 8, color: extColor(ext), fontWeight: 700, width: 20, textAlign: 'right', flexShrink: 0 }}>
                        {ext || '—'}
                      </span>
                      <span style={{ fontSize: 10, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.name}
                      </span>
                    </div>
                  )
                })}
                {files.length > 3 && (
                  <span style={{ fontSize: 9, color: '#777' }}>+{files.length - 3} more</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---- File list panel ----

interface FileListPanelProps {
  files: FileEntry[]
  loading: boolean
  selectedFile: string | null
  selectedGenre: GenreInfo | undefined
  onSelect: (path: string) => void
}

function FileListPanel({ files, loading, selectedFile, selectedGenre, onSelect }: FileListPanelProps): JSX.Element {
  return (
    <div style={{
      width: 220, flexShrink: 0,
      borderRight: '1px solid #1a1a1a',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{
        padding: '7px 10px', fontSize: 9, color: '#888', letterSpacing: 1,
        borderBottom: '1px solid #1a1a1a',
        display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
      }}>
        <span>FILES</span>
        {files.length > 0 && <span style={{ color: '#777' }}>{files.length}</span>}
      </div>

      {selectedGenre && (
        <div style={{
          padding: '3px 10px', fontSize: 9, color: '#777', fontFamily: 'monospace',
          borderBottom: '1px solid #111',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          {selectedGenre.dir}
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: '10px', fontSize: 11, color: '#333' }}>Loading...</div>
        ) : files.length === 0 ? (
          <div style={{ padding: '10px', fontSize: 11, color: '#777' }}>No files</div>
        ) : files.map((f) => {
          const ext = fileExt(f.name)
          const active = selectedFile === f.path
          return (
            <div
              key={f.path}
              onClick={() => onSelect(f.path)}
              style={{
                padding: '7px 10px', cursor: 'pointer',
                background: active ? '#1a1a1a' : 'transparent',
                borderBottom: '1px solid #111',
                borderLeft: `2px solid ${active ? (selectedGenre?.color ?? '#444') : 'transparent'}`,
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = '#141414' }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                <span style={{ fontSize: 9, color: extColor(ext), fontWeight: 700, width: 22, textAlign: 'right', flexShrink: 0 }}>
                  {ext || '—'}
                </span>
                <span style={{ fontSize: 11, color: active ? '#eee' : '#999', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.name}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, paddingLeft: 27 }}>
                <span style={{ fontSize: 9, color: '#777' }}>{formatSize(f.sizeBytes)}</span>
                <span style={{ fontSize: 9, color: '#777' }}>{timeAgo(f.modifiedMs)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---- Preview panel ----

interface PreviewPanelProps {
  selectedFile: string | null
  fileContent: string | null
  fileError: string | null
  loading: boolean
}

function PreviewPanel({ selectedFile, fileContent, fileError, loading }: PreviewPanelProps): JSX.Element {
  const fileName = selectedFile ? selectedFile.split('/').pop() ?? selectedFile : null
  const ext = fileName ? fileExt(fileName) : ''

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      <div style={{
        padding: '7px 14px', fontSize: 9, borderBottom: '1px solid #1a1a1a',
        display: 'flex', alignItems: 'center', gap: 8,
        flexShrink: 0, color: '#888', letterSpacing: 1,
      }}>
        {fileName ? (
          <>
            <span style={{ color: extColor(ext), fontWeight: 700 }}>{ext || 'FILE'}</span>
            <span style={{ color: '#aaa', fontSize: 11 }}>{fileName}</span>
            <span style={{ color: '#666', fontFamily: 'monospace', fontSize: 9, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {selectedFile}
            </span>
            <button
              onClick={() => invoke('open_file', { path: selectedFile })}
              style={{
                background: 'none', border: '1px solid #333', color: '#777', cursor: 'pointer',
                fontSize: 9, padding: '2px 7px', borderRadius: 3, flexShrink: 0,
                letterSpacing: 0.5,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#555'; e.currentTarget.style.color = '#aaa' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#777' }}
              title="Open in default editor"
            >
              OPEN
            </button>
          </>
        ) : (
          <span>PREVIEW</span>
        )}
      </div>

      <div style={{
        flex: 1, overflow: 'auto', padding: '14px 18px',
        fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
        fontSize: 12, lineHeight: 1.75,
        color: fileError ? '#ff4444' : '#ccc',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {!selectedFile ? (
          <span style={{ color: '#777' }}>← Select a file to preview</span>
        ) : loading ? (
          <span style={{ color: '#333' }}>Loading...</span>
        ) : fileError ? (
          fileError
        ) : (
          fileContent ?? ''
        )}
      </div>
    </div>
  )
}

// ---- Main OutputView ----

interface OutputViewProps {
  cellStates: Record<string, CellState>
  gridRows: number
  gridCols: number
  outputDir: string
}

export default function OutputView({ cellStates, gridRows, gridCols, outputDir }: OutputViewProps): JSX.Element {
  const [allFiles, setAllFiles] = useState<Record<string, FileEntry[]>>({})
  const [loadingGenres, setLoadingGenres] = useState<Set<string>>(new Set())
  const [summary, setSummary] = useState<string>('')
  const [summarizing, setSummarizing] = useState(false)
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [loadingContent, setLoadingContent] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)

  const language = localStorage.getItem('chaos-grid-language') ?? 'Japanese'

  const genres = useMemo<GenreInfo[]>(() => {
    const seen = new Set<string>()
    const result: GenreInfo[] = []
    getCellIds(gridRows, gridCols).forEach((id) => {
      const dir = cellWorkDir(id, cellStates[id], outputDir, gridCols)
      const name = dir.split('/').pop() ?? id
      if (!seen.has(name)) {
        seen.add(name)
        result.push({ name, dir, color: roleColor(getCellRole(id, gridCols)) })
      }
    })
    return result
  }, [cellStates, gridRows, gridCols, outputDir])

  const summarizeAll = useCallback((genreList: GenreInfo[]) => {
    setSummarizing(true)
    invoke<string>('summarize_all_genres', {
      genres: genreList.map((g) => ({ name: g.name, dir: g.dir })),
      language,
    })
      .then((result) => {
        setSummary(result)
        setSummarizing(false)
      })
      .catch((e) => {
        console.error('summarize_all_genres failed:', e)
        setSummarizing(false)
      })
  }, [language])

  // Load files for all genres in parallel, then summarize all at once
  const loadAll = useCallback((genreList: GenreInfo[]) => {
    setLoadingGenres(new Set(genreList.map((g) => g.name)))
    setSummary('')
    let remaining = genreList.length
    const nextAllFiles: Record<string, FileEntry[]> = {}

    genreList.forEach((g) => {
      invoke<FileEntry[]>('list_dir_files_recursive', { path: g.dir })
        .then((list) => {
          nextAllFiles[g.name] = list.sort((a, b) => b.modifiedMs - a.modifiedMs)
        })
        .catch(() => { nextAllFiles[g.name] = [] })
        .finally(() => {
          setAllFiles((prev) => ({ ...prev, [g.name]: nextAllFiles[g.name] }))
          setLoadingGenres((prev) => { const next = new Set(prev); next.delete(g.name); return next })
          remaining--
          if (remaining === 0) {
            const hasAny = genreList.some((g) => (nextAllFiles[g.name] ?? []).length > 0)
            if (hasAny) summarizeAll(genreList)
          }
        })
    })
  }, [summarizeAll])

  const genreSignatureRef = useRef<string>('')
  useEffect(() => {
    if (genres.length === 0) return
    const sig = genres.map((g) => `${g.name}:${g.dir}`).join(',')
    if (sig === genreSignatureRef.current) return
    genreSignatureRef.current = sig
    loadAll(genres)
  }, [genres, loadAll])

  // Auto-refresh files every 30 seconds (without re-summarizing)
  useEffect(() => {
    if (genres.length === 0) return
    const interval = setInterval(() => {
      genres.forEach((g) => {
        invoke<FileEntry[]>('list_dir_files_recursive', { path: g.dir })
          .then((list) => {
            setAllFiles((prev) => ({ ...prev, [g.name]: list.sort((a, b) => b.modifiedMs - a.modifiedMs) }))
          })
          .catch(() => {})
      })
    }, 30_000)
    return () => clearInterval(interval)
  }, [genres])

  // Auto-select first genre
  useEffect(() => {
    if (genres.length > 0 && selectedGenre === null) {
      setSelectedGenre(genres[0].name)
    }
  }, [genres, selectedGenre])

  // Auto-select first file when genre changes
  useEffect(() => {
    const files = allFiles[selectedGenre ?? ''] ?? []
    setSelectedFile(files.length > 0 ? files[0].path : null)
    setFileContent(null)
    setFileError(null)
  }, [selectedGenre, allFiles])

  // Load file content
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
  const currentFiles = allFiles[selectedGenre ?? ''] ?? []
  const isLoading = loadingGenres.size > 0

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0a0a0a' }}>
      <SummaryBar
        genres={genres}
        allFiles={allFiles}
        summary={summary}
        summarizing={summarizing}
        loading={isLoading}
        selected={selectedGenre}
        onSelect={setSelectedGenre}
        onRefresh={() => loadAll(genres)}
      />

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <FileListPanel
          files={currentFiles}
          loading={loadingGenres.has(selectedGenre ?? '')}
          selectedFile={selectedFile}
          selectedGenre={selectedGenreInfo}
          onSelect={setSelectedFile}
        />
        <PreviewPanel
          selectedFile={selectedFile}
          fileContent={fileContent}
          fileError={fileError}
          loading={loadingContent}
        />
      </div>
    </div>
  )
}
