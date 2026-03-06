# CHAOS GRID

A configurable terminal grid for running multiple AI coding agents in parallel.

```
┌──────────────┬──────────────┬──────────────┐
│    Supply    │     Will     │   Stimulus   │
├──────────────┼──────────────┼──────────────┤
│  claude code │  claude code │  claude code │
├──────────────┼──────────────┼──────────────┤
│  claude code │  claude code │  claude code │
├──────────────┼──────────────┼──────────────┤
│  claude code │  claude code │  claude code │
└──────────────┴──────────────┴──────────────┘
```

## The Idea

Knowledge work has three layers:

| Layer | Role | Column |
|-------|------|--------|
| **Stimulus** | Receive from outside — research, reading, exploration | Right |
| **Will** | Convert to personal intent — thinking, deciding, synthesizing | Center |
| **Supply** | Create and ship — writing, coding, publishing | Left |

Assign themes to each cell, run Claude Code (or any CLI tool) in all of them simultaneously, and let the AI analyze where flow from Stimulus → Will → Supply breaks down.

## Features

- **Configurable terminal grid** — up to 6×5 real PTY terminals (30 cells), each named and themed
- **LAUNCH ALL** — sends `claude --dangerously-skip-permissions` (or any custom CLI) to all terminals at once
- **Broadcast** — type once, send to all active agents simultaneously
- **OS notifications** — get notified when an agent needs your input
- **Session cost tracking** — per-cell cumulative cost parsed from Claude Code output
- **Auto-restart** — cells automatically relaunch the agent after it exits
- **Task queue** — pre-queue prompts per cell; auto-send on agent exit
- **Session restore** — relaunch all cells on next startup from saved session
- **Grid presets** — save and load grid/tool configurations by name
- **Git worktrees** — each cell gets its own branch for parallel safe editing
- **Keyboard navigation** — Cmd+1-9 to focus cells, Cmd+Shift+L/R/G/C for global shortcuts
- **Drag-to-resize** — column and cell height resize by dragging
- **CONTROL mode** — AI analyzes all terminals and diagnoses the Stimulus → Will → Supply flow

## Requirements

- macOS (primary target; Windows untested)
- [Rust](https://rustup.rs/) 1.77+
- Node.js 18+
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — `npm i -g @anthropic-ai/claude-code`
- Optional: Gemini/OpenAI/Anthropic API key for the CONTROL analysis feature

## Setup

```bash
git clone https://github.com/onoz1169/chaos-grid.git
cd chaos-grid
npm install
npm run dev
```

API keys can be configured in the Settings panel (⚙) inside the app, or via environment file:

```bash
# ~/.chaos-grid.env
GEMINI_API_KEY=your_key_here
```

## Usage

| Action | How |
|--------|-----|
| Launch agent in all cells | Click **⚡ LAUNCH ALL** or `Cmd+Shift+L` |
| Launch agent in one cell | Click **▶** in the cell header |
| Send text to all active agents | Type in the **Broadcast** field and press Enter |
| Focus a specific cell | `Cmd+1` through `Cmd+9` |
| Switch to grid view | `Cmd+Shift+G` |
| Switch to control view | `Cmd+Shift+C` |
| Reset all sessions | Click **⟳ RESET ALL** or `Cmd+Shift+R` |
| Rename a theme | Double-click the theme label in the cell header |
| Hide a cell | Click **✕** in the cell header |
| Queue tasks per cell | CONTROL mode → **Tasks** tab |
| Analyze the flow | CONTROL mode → click **⟳ Analyze** |

## Settings

All settings are accessible via the **⚙** button in the top bar.

| Setting | Description |
|---------|-------------|
| Presets | Save/load named grid configurations |
| Output Directory | Working directory root for each cell |
| CLI Tool | `claude`, `codex`, or any custom command |
| Git Worktree | Auto-create per-cell branches from a shared repo |
| Grid Size | Rows (1-6) × Columns (1-5) |
| AI Language | Language for auto-naming and analysis output |

## Stack

- [Tauri v2](https://v2.tauri.app/) — Rust backend + system WebView
- [React](https://react.dev/) + TypeScript
- [xterm.js](https://xtermjs.org/) — terminal emulation
- [portable-pty](https://github.com/wez/wezterm/tree/main/pty) — real PTY process management
- [tauri-plugin-notification](https://github.com/tauri-apps/plugins-workspace) — OS notifications

## License

MIT
