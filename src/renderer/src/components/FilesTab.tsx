import { type JSX } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { fileExt, extColor, timeAgo, formatSize } from '../utils/files'
import type { FileEntry, GenreInfo } from '../utils/output-types'

const GIT_STATUS_COLOR: Record<string, string> = { A: '#00cc66', M: '#ffaa44', D: '#ff4466', '?': '#555' }

// ---- File list panel ----

interface FileListPanelProps {
  files: FileEntry[]
  loading: boolean
  selectedFile: string | null
  selectedGenre: GenreInfo | undefined
  fileStatuses: Record<string, string>
  onSelect: (path: string) => void
}

export function FileListPanel({ files, loading, selectedFile, selectedGenre, fileStatuses, onSelect }: FileListPanelProps): JSX.Element {
  return (
    <div style={{ width: 220, flexShrink: 0, borderRight: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '7px 10px', fontSize: 10, color: '#666', letterSpacing: 1, borderBottom: '1px solid #1a1a1a', display: 'flex', gap: 6, flexShrink: 0 }}>
        <span>FILES</span>
        {files.length > 0 && <span style={{ color: '#555' }}>{files.length}</span>}
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ padding: 10, fontSize: 11, color: '#555' }}>Loading...</div>
        ) : files.length === 0 ? (
          <div style={{ padding: 10, fontSize: 11, color: '#444' }}>No files</div>
        ) : files.map((f) => {
          const ext = fileExt(f.name)
          const active = selectedFile === f.path
          const gitStatus = fileStatuses[f.name] ?? null
          return (
            <div
              key={f.path}
              onClick={() => onSelect(f.path)}
              style={{
                padding: '6px 10px', cursor: 'pointer',
                background: active ? '#1a1a1a' : 'transparent',
                borderBottom: '1px solid #111',
                borderLeft: `2px solid ${active ? (selectedGenre?.color ?? '#444') : 'transparent'}`,
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = '#141414' }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                {gitStatus && (
                  <span style={{ fontSize: 8, color: GIT_STATUS_COLOR[gitStatus] ?? '#555', width: 8, flexShrink: 0, fontWeight: 700 }}>{gitStatus}</span>
                )}
                <span style={{ fontSize: 8, color: extColor(ext), fontWeight: 700, width: 22, textAlign: 'right', flexShrink: 0 }}>{ext || '—'}</span>
                <span style={{ fontSize: 12, color: active ? '#fff' : '#ccc', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.name.split('/').pop() ?? f.name}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, paddingLeft: 30 }}>
                <span style={{ fontSize: 9, color: '#777' }}>{formatSize(f.sizeBytes)}</span>
                <span style={{ fontSize: 9, color: '#666' }}>{timeAgo(f.modifiedMs)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---- File preview panel ----

interface FilePreviewProps {
  selectedFile: string | null
  fileContent: string | null
  fileError: string | null
  loading: boolean
}

export function FilePreview({ selectedFile, fileContent, fileError, loading }: FilePreviewProps): JSX.Element {
  const fileName = selectedFile ? selectedFile.split('/').pop() ?? selectedFile : null
  const ext = fileName ? fileExt(fileName) : ''
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      {fileName && (
        <div style={{ padding: '0 12px', height: 28, borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ color: extColor(ext), fontWeight: 700, fontSize: 9 }}>{ext || 'FILE'}</span>
          <span style={{ color: '#aaa', fontSize: 11 }}>{fileName}</span>
          <span style={{ flex: 1 }} />
          {fileContent && (
            <button
              onClick={() => navigator.clipboard.writeText(fileContent)}
              style={{ background: 'none', border: '1px solid #222', color: '#555', cursor: 'pointer', fontSize: 9, padding: '2px 7px', borderRadius: 3 }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = '#aaa' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.color = '#555' }}
            >COPY</button>
          )}
          <button
            onClick={() => invoke('open_file', { path: selectedFile })}
            style={{ background: 'none', border: '1px solid #222', color: '#555', cursor: 'pointer', fontSize: 9, padding: '2px 7px', borderRadius: 3 }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#444'; e.currentTarget.style.color = '#aaa' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.color = '#555' }}
          >OPEN</button>
        </div>
      )}
      <div style={{
        flex: 1, overflow: 'auto', padding: '12px 16px',
        fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
        fontSize: 12, lineHeight: 1.75,
        color: fileError ? '#ff4444' : '#ccc',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {!selectedFile ? (
          <span style={{ color: '#444' }}>Select a file to preview</span>
        ) : loading ? (
          <span style={{ color: '#444' }}>Loading...</span>
        ) : fileError ? fileError : (fileContent ?? '')}
      </div>
    </div>
  )
}
