import { useState, useEffect, useCallback, type JSX } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { CellState } from '../../../shared/types'

function getStorageKey(cellId: string) { return `chaos-grid-tasks-${cellId}` }

function loadTasks(cellId: string): string[] {
  try { return JSON.parse(localStorage.getItem(getStorageKey(cellId)) ?? '[]') } catch { return [] }
}

function saveTasks(cellId: string, tasks: string[]) {
  localStorage.setItem(getStorageKey(cellId), JSON.stringify(tasks))
}

interface TaskQueueProps {
  cellIds: string[]
  cellStates: Record<string, CellState>
}

interface PtyExitedPayload {
  cell_id: string
}

export default function TaskQueue({ cellIds, cellStates }: TaskQueueProps): JSX.Element {
  const [selectedCellId, setSelectedCellId] = useState<string>(cellIds[0] ?? '')
  const [tasks, setTasks] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {}
    cellIds.forEach((id) => { init[id] = loadTasks(id) })
    return init
  })
  const [inputValue, setInputValue] = useState('')

  // Sync tasks to localStorage whenever they change
  useEffect(() => {
    cellIds.forEach((id) => {
      saveTasks(id, tasks[id] ?? [])
    })
  }, [tasks, cellIds])

  // Listen for pty-exited events and auto-send next task
  useEffect(() => {
    const unlistenPromise = listen<PtyExitedPayload>('pty-exited', (event) => {
      const cellId = event.payload?.cell_id
      if (!cellId) return
      const cellTasks = loadTasks(cellId)
      if (cellTasks.length === 0) return
      const [nextTask, ...remaining] = cellTasks
      saveTasks(cellId, remaining)
      setTasks((prev) => ({ ...prev, [cellId]: remaining }))
      // Send next task after 2 seconds
      setTimeout(() => {
        invoke('write_pty', { cellId, data: nextTask + '\n' }).catch(() => {})
      }, 2000)
    })
    return () => { unlistenPromise.then((fn) => fn()) }
  }, [])

  const addTask = useCallback(() => {
    const trimmed = inputValue.trim()
    if (!trimmed || !selectedCellId) return
    setTasks((prev) => {
      const updated = [...(prev[selectedCellId] ?? []), trimmed]
      saveTasks(selectedCellId, updated)
      return { ...prev, [selectedCellId]: updated }
    })
    setInputValue('')
  }, [inputValue, selectedCellId])

  const removeTask = useCallback((cellId: string, index: number) => {
    setTasks((prev) => {
      const updated = (prev[cellId] ?? []).filter((_, i) => i !== index)
      saveTasks(cellId, updated)
      return { ...prev, [cellId]: updated }
    })
  }, [])

  const sendNow = useCallback((cellId: string) => {
    const cellTasks = tasks[cellId] ?? []
    if (cellTasks.length === 0) return
    const [nextTask, ...remaining] = cellTasks
    saveTasks(cellId, remaining)
    setTasks((prev) => ({ ...prev, [cellId]: remaining }))
    invoke('write_pty', { cellId, data: nextTask + '\n' }).catch(() => {})
  }, [tasks])

  const currentTasks = tasks[selectedCellId] ?? []

  const labelStyle: React.CSSProperties = {
    fontSize: 9, color: '#666', letterSpacing: 1, marginBottom: 6,
  }

  const cellBtnStyle = (active: boolean): React.CSSProperties => ({
    background: active ? '#1a1a1a' : 'none',
    border: `1px solid ${active ? '#333' : '#1a1a1a'}`,
    color: active ? '#ccc' : '#555',
    cursor: 'pointer',
    fontSize: 10,
    padding: '3px 8px',
    borderRadius: 3,
    fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
  })

  return (
    <div style={{
      flex: 1, overflow: 'auto', padding: '12px 16px',
      fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
      display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      {/* Cell selector */}
      <div>
        <div style={labelStyle}>SELECT CELL</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {cellIds.map((id) => {
            const queueLen = (tasks[id] ?? []).length
            return (
              <button
                key={id}
                onClick={() => setSelectedCellId(id)}
                style={cellBtnStyle(selectedCellId === id)}
              >
                {id}{queueLen > 0 ? ` (${queueLen})` : ''}
              </button>
            )
          })}
        </div>
      </div>

      {selectedCellId && (
        <>
          {/* Add task */}
          <div>
            <div style={labelStyle}>ADD TASK FOR {selectedCellId.toUpperCase()}</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); addTask() }
                }}
                placeholder="Enter task prompt (Cmd+Enter to add)"
                rows={3}
                style={{
                  flex: 1, background: '#0d0d0d', border: '1px solid #222',
                  color: '#ccc', fontSize: 11, padding: '6px 8px',
                  borderRadius: 3, resize: 'vertical', fontFamily: 'inherit',
                  outline: 'none',
                }}
              />
              <button
                onClick={addTask}
                disabled={!inputValue.trim()}
                style={{
                  background: inputValue.trim() ? '#1a2a1a' : '#111',
                  border: `1px solid ${inputValue.trim() ? '#2a4a2a' : '#1a1a1a'}`,
                  color: inputValue.trim() ? '#4ade80' : '#333',
                  cursor: inputValue.trim() ? 'pointer' : 'default',
                  fontSize: 10, padding: '6px 10px', borderRadius: 3,
                  alignSelf: 'flex-start',
                }}
              >
                ADD
              </button>
            </div>
          </div>

          {/* Task list */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <div style={labelStyle}>
                QUEUE ({currentTasks.length} task{currentTasks.length !== 1 ? 's' : ''})
              </div>
              {currentTasks.length > 0 && (
                <button
                  onClick={() => sendNow(selectedCellId)}
                  style={{
                    background: '#1a1f2a', border: '1px solid #2a3a4a',
                    color: '#60a5fa', cursor: 'pointer', fontSize: 9,
                    padding: '2px 8px', borderRadius: 3,
                  }}
                >
                  SEND NOW
                </button>
              )}
            </div>

            {currentTasks.length === 0 ? (
              <div style={{ fontSize: 11, color: '#444' }}>No tasks queued. Add tasks above.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {currentTasks.map((task, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex', gap: 8, alignItems: 'flex-start',
                      background: '#0d0d0d', border: '1px solid #1a1a1a',
                      borderRadius: 3, padding: '6px 8px',
                    }}
                  >
                    <span style={{ fontSize: 9, color: '#555', flexShrink: 0, paddingTop: 2, minWidth: 16 }}>
                      {i + 1}.
                    </span>
                    <span style={{ fontSize: 11, color: '#aaa', flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5 }}>
                      {task}
                    </span>
                    <button
                      onClick={() => removeTask(selectedCellId, i)}
                      style={{
                        background: 'none', border: 'none', color: '#444',
                        cursor: 'pointer', fontSize: 11, padding: '0 2px',
                        flexShrink: 0,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.color = '#f87171' }}
                      onMouseLeave={e => { e.currentTarget.style.color = '#444' }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cell status info */}
          {cellStates[selectedCellId] && (
            <div>
              <div style={labelStyle}>CELL STATUS</div>
              <div style={{ fontSize: 11, color: '#555' }}>
                status: <span style={{ color: '#888' }}>{cellStates[selectedCellId].status}</span>
                {cellStates[selectedCellId].pid != null && (
                  <span style={{ marginLeft: 10 }}>
                    pid: <span style={{ color: '#888' }}>{cellStates[selectedCellId].pid}</span>
                  </span>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
