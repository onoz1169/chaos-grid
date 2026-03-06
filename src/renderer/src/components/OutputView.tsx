import { useState, useEffect, useCallback, useMemo, useRef, type JSX } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { CellState } from '../../../shared/types'
import { getCellIds, getCellRole, roleColor, cellWorkDir } from '../../../shared/types'
import type { FileEntry, GenreInfo, GitInfo, ActivityEntry } from '../utils/output-types'
import AgentStatusBar from './AgentStatusBar'
import GenreSelector from './GenreSelector'
import { FileListPanel, FilePreview } from './FilesTab'
import GitPanel from './GitPanel'
import DashboardView from './DashboardView'
import TaskQueue from './TaskQueue'

type RightMode = 'dashboard' | 'files' | 'git' | 'tasks'

interface OutputViewProps {
  cellStates: Record<string, CellState>
  gridRows: number
  gridCols: number
  outputDir: string
}

const tabStyle = (active: boolean) => ({
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 10, padding: '0 12px', letterSpacing: 1,
  color: active ? '#ccc' : '#555',
  borderBottom: `2px solid ${active ? '#444' : 'transparent'}`,
  height: '100%',
})

export default function OutputView({ cellStates, gridRows, gridCols, outputDir }: OutputViewProps): JSX.Element {
  const [allFiles, setAllFiles] = useState<Record<string, FileEntry[]>>({})
  const [loadingGenres, setLoadingGenres] = useState<Set<string>>(new Set())
  const [activityEntries, setActivityEntries] = useState<ActivityEntry[]>([])
  const [loadingActivity, setLoadingActivity] = useState(false)
  const [summary, setSummary] = useState<string>('')
  const [summarizing, setSummarizing] = useState(false)
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string | null>(null)
  const [loadingContent, setLoadingContent] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [rightMode, setRightMode] = useState<RightMode>('dashboard')
  const [gitInfo, setGitInfo] = useState<GitInfo | null>(null)
  const [gitLoading, setGitLoading] = useState(false)

  const language = localStorage.getItem('chaos-grid-language') ?? 'Japanese'

  const genres = useMemo<GenreInfo[]>(() => {
    const seen = new Set<string>()
    const result: GenreInfo[] = []
    getCellIds(gridRows, gridCols).forEach((id) => {
      const role = getCellRole(id, gridCols)
      const dir = cellWorkDir(id, cellStates[id], outputDir, gridCols)
      const name = dir.split('/').pop() ?? id
      if (!seen.has(name)) {
        seen.add(name)
        result.push({ name, dir, color: roleColor(role), role, cellId: id })
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
      .then((r) => { setSummary(r); setSummarizing(false) })
      .catch(() => setSummarizing(false))
  }, [language])

  const loadFiles = useCallback((genreList: GenreInfo[]) => {
    setLoadingGenres(new Set(genreList.map((g) => g.name)))
    genreList.forEach((g) => {
      invoke<FileEntry[]>('list_dir_files_recursive', { path: g.dir })
        .then((list) => setAllFiles((prev) => ({ ...prev, [g.name]: list.sort((a, b) => b.modifiedMs - a.modifiedMs) })))
        .catch(() => setAllFiles((prev) => ({ ...prev, [g.name]: [] })))
        .finally(() => setLoadingGenres((prev) => { const n = new Set(prev); n.delete(g.name); return n }))
    })
  }, [])

  const loadActivity = useCallback((genreList: GenreInfo[]) => {
    if (genreList.length === 0) return
    setLoadingActivity(true)
    invoke<ActivityEntry[]>('get_all_git_activity', {
      dirs: genreList.map((g) => g.dir),
      genres: genreList.map((g) => g.name),
    })
      .then((list) => { setActivityEntries(list); setLoadingActivity(false) })
      .catch(() => setLoadingActivity(false))
  }, [])

  const loadGitInfo = useCallback((dir: string) => {
    setGitLoading(true)
    invoke<GitInfo>('get_git_info', { path: dir })
      .then((info) => { setGitInfo(info); setGitLoading(false) })
      .catch(() => { setGitInfo(null); setGitLoading(false) })
  }, [])

  const genreSigRef = useRef('')
  useEffect(() => {
    if (genres.length === 0) return
    const sig = genres.map((g) => `${g.name}:${g.dir}`).join(',')
    if (sig === genreSigRef.current) return
    genreSigRef.current = sig
    loadFiles(genres)
    loadActivity(genres)
  }, [genres, loadFiles, loadActivity])

  // Auto-refresh every 30s
  useEffect(() => {
    if (genres.length === 0) return
    const iv = setInterval(() => {
      genres.forEach((g) => {
        invoke<FileEntry[]>('list_dir_files_recursive', { path: g.dir })
          .then((list) => setAllFiles((prev) => ({ ...prev, [g.name]: list.sort((a, b) => b.modifiedMs - a.modifiedMs) })))
          .catch(() => {})
      })
      loadActivity(genres)
    }, 30_000)
    return () => clearInterval(iv)
  }, [genres, loadActivity])

  // Auto-select first genre
  useEffect(() => {
    if (genres.length > 0 && !selectedGenre) setSelectedGenre(genres[0].name)
  }, [genres, selectedGenre])

  // Auto-select first file when genre changes
  useEffect(() => {
    const files = allFiles[selectedGenre ?? ''] ?? []
    setSelectedFile(files[0]?.path ?? null)
    setFileContent(null)
    setFileError(null)
  }, [selectedGenre, allFiles])

  // Load git info for selected genre
  useEffect(() => {
    const g = genres.find((g) => g.name === selectedGenre)
    if (g) loadGitInfo(g.dir)
    else setGitInfo(null)
  }, [selectedGenre, genres, loadGitInfo])

  // Auto-refresh git every 30s
  useEffect(() => {
    const g = genres.find((g) => g.name === selectedGenre)
    if (!g) return
    const iv = setInterval(() => loadGitInfo(g.dir), 30_000)
    return () => clearInterval(iv)
  }, [selectedGenre, genres, loadGitInfo])

  // Auto-summarize on first load
  const autoSummarizedRef = useRef(false)
  useEffect(() => {
    if (autoSummarizedRef.current || genres.length === 0 || loadingGenres.size > 0) return
    const total = genres.reduce((s, g) => s + (allFiles[g.name]?.length ?? 0), 0)
    if (total === 0) return
    autoSummarizedRef.current = true
    summarizeAll(genres)
  }, [allFiles, genres, loadingGenres, summarizeAll])

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
        Set an output directory in Settings (⚙) to use this view.
      </div>
    )
  }

  const selectedGenreInfo = genres.find((g) => g.name === selectedGenre)
  const currentFiles = allFiles[selectedGenre ?? ''] ?? []
  const fileStatuses = gitInfo?.fileStatuses ?? {}

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0a0a0a' }}>
      <AgentStatusBar cellStates={cellStates} />

      {/* Tab bar */}
      <div style={{
        height: 34, borderBottom: '1px solid #1a1a1a', background: '#080808',
        display: 'flex', alignItems: 'stretch', flexShrink: 0, paddingLeft: 4,
      }}>
        <button style={tabStyle(rightMode === 'dashboard')} onClick={() => setRightMode('dashboard')}>DASHBOARD</button>
        <button style={tabStyle(rightMode === 'files')} onClick={() => setRightMode('files')}>FILES</button>
        <button style={tabStyle(rightMode === 'git')} onClick={() => setRightMode('git')}>GIT</button>
        <button style={tabStyle(rightMode === 'tasks')} onClick={() => setRightMode('tasks')}>TASKS</button>
      </div>

      {/* Content */}
      {rightMode === 'dashboard' ? (
        <DashboardView
          genres={genres}
          cellStates={cellStates}
          allFiles={allFiles}
          activityEntries={activityEntries}
          loadingActivity={loadingActivity}
          summary={summary}
          summarizing={summarizing}
          onSummarize={() => summarizeAll(genres)}
          onRefresh={() => { loadFiles(genres); loadActivity(genres) }}
          onSelectGenre={(name) => { setSelectedGenre(name); setRightMode('files') }}
          gridCols={gridCols}
        />
      ) : rightMode === 'tasks' ? (
        <TaskQueue
          cellIds={getCellIds(gridRows, gridCols)}
          cellStates={cellStates}
        />
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <GenreSelector genres={genres} selected={selectedGenre} onSelect={setSelectedGenre} />
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {rightMode === 'files' ? (
              <>
                <FileListPanel
                  files={currentFiles}
                  loading={loadingGenres.has(selectedGenre ?? '')}
                  selectedFile={selectedFile}
                  selectedGenre={selectedGenreInfo}
                  fileStatuses={fileStatuses}
                  onSelect={setSelectedFile}
                />
                <FilePreview
                  selectedFile={selectedFile}
                  fileContent={fileContent}
                  fileError={fileError}
                  loading={loadingContent}
                />
              </>
            ) : (
              <GitPanel
                selectedGenre={selectedGenreInfo}
                gitInfo={gitInfo}
                loading={gitLoading}
                onRefresh={() => selectedGenreInfo && loadGitInfo(selectedGenreInfo.dir)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
