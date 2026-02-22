import * as pty from 'node-pty'

interface PtySession {
  pty: pty.IPty
  buffer: string
}

const sessions = new Map<string, PtySession>()

const BUFFER_LIMIT = 2000

export function spawnPty(
  cellId: string,
  cols: number,
  rows: number,
  onData: (data: string) => void
): number {
  killPty(cellId)

  const shell = process.env.SHELL || '/bin/zsh'

  // Remove Claude Code env vars so nested claude sessions can start
  const { CLAUDECODE, CLAUDE_CODE_ENTRYPOINT, npm_config_prefix, ...cleanEnv } = process.env
  void CLAUDECODE; void CLAUDE_CODE_ENTRYPOINT; void npm_config_prefix

  const p = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: process.env.HOME || '/',
    env: cleanEnv as Record<string, string>
  })

  const session: PtySession = { pty: p, buffer: '' }
  sessions.set(cellId, session)

  p.onData((data: string) => {
    session.buffer += data
    if (session.buffer.length > BUFFER_LIMIT * 2) {
      session.buffer = session.buffer.slice(-BUFFER_LIMIT)
    }
    onData(data)
  })

  return p.pid
}

export function writePty(cellId: string, data: string): void {
  const session = sessions.get(cellId)
  if (session) {
    session.pty.write(data)
  }
}

export function resizePty(cellId: string, cols: number, rows: number): void {
  const session = sessions.get(cellId)
  if (session) {
    session.pty.resize(cols, rows)
  }
}

export function killPty(cellId: string): void {
  const session = sessions.get(cellId)
  if (session) {
    session.pty.kill()
    sessions.delete(cellId)
  }
}

export function getBuffer(cellId: string): string {
  const session = sessions.get(cellId)
  if (!session) return ''
  return session.buffer.slice(-BUFFER_LIMIT)
}

export function hasPty(cellId: string): boolean {
  return sessions.has(cellId)
}

export function sendCommand(cellId: string, command: string): void {
  const session = sessions.get(cellId)
  if (session) {
    session.pty.write(command)
  }
}
