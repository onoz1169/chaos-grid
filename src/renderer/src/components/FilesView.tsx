import { useState, useEffect, useCallback, type JSX } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { CellState } from '../../../shared/types'
import { getCellIds, getCellRole } from '../../../shared/types'

function cellWorkDir(cellId: string, cellState: CellState | undefined, outputDir: string, gridCols: number): string {
  const theme = cellState?.theme
  const role = getCellRole(cellId, gridCols).toLowerCase()
  const folderName = theme || role
  return `${outputDir.replace(/\/$/, '')}/${folderName}`
}

interface FileEntry {
  name: string
  path: string
  modifiedMs: number
  sizeBytes: number
  isDir: boolean
}

const ROLE_COLORS: Record<string, string> = {
  Stimulus: '#4488bb',
  Will: '#bb8844',
  Supply: '#00ff88',
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
    md: '#aaa', json: '#bb8844', yaml: '#bb8844', yml: '#bb8844',
    css: '#bb44bb', html: '#bb6644', sh: '#44bb88',
  }
  return map[ext] ?? '#666'
}

interface FileContentModalProps {
  path: string
  onClose: () => void
}

function FileContentModal({ path, onClose }: FileContentModalProps): JSX.Element {
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    invoke<string>('read_file_content', { path })
      .then(setContent)
      .catch((e) => setError(String(e)))
  }, [path])

  const name = path.split('/').pop() ?? path
  const ext = fileExt(name)

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#111', border: '1px solid #333',
          width: '80vw', height: '80vh',
          display: 'flex', flexDirection: 'column',
          borderRadius: 4, overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div style={{
          padding: '8px 12px', borderBottom: '1px solid #222',
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#0f0f0f', flexShrink: 0,
        }}>
          <span style={{ color: extColor(ext), fontSize: 11, fontWeight: 700 }}>.{ext}</span>
          <span style={{ color: '#ccc', fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {path}
          </span>
          <button className="btn-icon" onClick={onClose} title="Close">✕</button>
        </div>
        {/* Content */}
        <div style={{
          flex: 1, overflow: 'auto', padding: 16,
          fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
          fontSize: 12, lineHeight: 1.6,
          color: error ? '#ff4444' : '#ccc',
          whiteSpace: 'pre',
        }}>
          {content ?? error ?? 'Loading...'}
        </div>
      </div>
    </div>
  )
}

interface CellFilesPanelProps {
  cellId: string
  cellState: CellState | undefined
  outputDir: string
  gridCols: number
}

function CellFilesPanel({ cellId, cellState, outputDir, gridCols }: CellFilesPanelProps): JSX.Element {
  const [files, setFiles] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openFile, setOpenFile] = useState<string | null>(null)

  const cellDir = cellWorkDir(cellId, cellState, outputDir, gridCols)
  const role = getCellRole(cellId, gridCols)
  const color = ROLE_COLORS[role] ?? '#888'

  const fetchFiles = useCallback(() => {
    if (!outputDir.trim()) return
    setLoading(true)
    setError(null)
    invoke<FileEntry[]>('list_dir_files', { path: cellDir })
      .then((list) => {
        setFiles(list.filter((f) => !f.isDir))
        setLoading(false)
      })
      .catch((e) => {
        setError(String(e).includes('No such file') ? 'No output yet' : String(e))
        setFiles([])
        setLoading(false)
      })
  }, [cellDir, outputDir])

  useEffect(() => {
    fetchFiles()
    const id = setInterval(fetchFiles, 10_000)
    return () => clearInterval(id)
  }, [fetchFiles])

  const statusColor =
    cellState?.status === 'active' ? '#00ff88' :
    cellState?.status === 'thinking' ? '#ffcc00' : '#333'

  return (
    <>
      <div style={{
        background: '#0f0f0f',
        border: `1px solid ${color}22`,
        borderTop: `2px solid ${color}66`,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', minHeight: 0,
      }}>
        {/* Panel header */}
        <div style={{
          padding: '4px 8px', borderBottom: '1px solid #1a1a1a',
          display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
          <span style={{ fontSize: 9, color, fontWeight: 700, letterSpacing: 1, flexShrink: 0 }}>
            {role.toUpperCase()}
          </span>
          <span style={{ fontSize: 11, color: '#888', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {cellState?.theme || cellId}
          </span>
          <button
            className="btn-icon"
            onClick={fetchFiles}
            title="Refresh"
            style={{ fontSize: 10, opacity: loading ? 0.4 : 1 }}
          >
            ⟳
          </button>
        </div>

        {/* Dir path */}
        <div style={{
          padding: '2px 8px', borderBottom: '1px solid #1a1a1a',
          fontSize: 9, color: '#444', fontFamily: 'monospace',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          {cellDir}
        </div>

        {/* File list */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {error ? (
            <div style={{ padding: '8px', fontSize: 11, color: '#333' }}>{error}</div>
          ) : files.length === 0 ? (
            <div style={{ padding: '8px', fontSize: 11, color: '#2a2a2a' }}>
              {loading ? 'Loading...' : 'No files'}
            </div>
          ) : (
            files.map((f) => {
              const ext = fileExt(f.name)
              return (
                <div
                  key={f.path}
                  onClick={() => setOpenFile(f.path)}
                  style={{
                    padding: '4px 8px',
                    display: 'flex', alignItems: 'center', gap: 6,
                    cursor: 'pointer', borderBottom: '1px solid #141414',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#1a1a1a')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: 9, color: extColor(ext), fontWeight: 700, width: 28, flexShrink: 0, textAlign: 'right' }}>
                    {ext || '—'}
                  </span>
                  <span style={{
                    fontSize: 11, color: '#ccc', flex: 1,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {f.name}
                  </span>
                  <span style={{ fontSize: 9, color: '#444', flexShrink: 0 }}>{formatSize(f.sizeBytes)}</span>
                  <span style={{ fontSize: 9, color: '#333', flexShrink: 0, width: 48, textAlign: 'right' }}>
                    {timeAgo(f.modifiedMs)}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>

      {openFile && <FileContentModal path={openFile} onClose={() => setOpenFile(null)} />}
    </>
  )
}

interface FilesViewProps {
  cellStates: Record<string, CellState>
  gridRows: number
  gridCols: number
  outputDir: string
}

export default function FilesView({ cellStates, gridRows, gridCols, outputDir }: FilesViewProps): JSX.Element {
  const cellIds = getCellIds(gridRows, gridCols)

  if (!outputDir.trim()) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#333', fontSize: 13,
      }}>
        Set an output directory in the toolbar to use this view.
      </div>
    )
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
      gridTemplateRows: `repeat(${gridRows}, 1fr)`,
      gap: 4, padding: 8,
      flex: 1, overflow: 'hidden',
      background: '#0a0a0a',
    }}>
      {cellIds.map((id) => (
        <CellFilesPanel
          key={id}
          cellId={id}
          cellState={cellStates[id]}
          outputDir={outputDir}
          gridCols={gridCols}
        />
      ))}
    </div>
  )
}
