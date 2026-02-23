import { useState, useEffect, useCallback, type JSX } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { CellState } from '../../../shared/types'
import { getCellIds, getCellRole, roleColor, cellWorkDir } from '../../../shared/types'
import { fileExt, extColor, timeAgo, formatSize } from '../utils/files'
import FileContentModal from './FileContentModal'

interface FileEntry {
  name: string
  path: string
  modifiedMs: number
  sizeBytes: number
  isDir: boolean
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
  const color = roleColor(role)

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

        <div style={{
          padding: '2px 8px', borderBottom: '1px solid #1a1a1a',
          fontSize: 9, color: '#444', fontFamily: 'monospace',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          flexShrink: 0,
        }}>
          {cellDir}
        </div>

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
