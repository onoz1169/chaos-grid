<!-- GitHub description: A parallel AI agent orchestrator for diagnosing and accelerating knowledge work flows -->

# CHAOS GRID

A desktop tool for running multiple AI coding agents in parallel and diagnosing where your knowledge work flow breaks down.

<!-- TODO: Replace with actual GIF/screenshot -->
![CHAOS GRID screenshot](docs/assets/screenshot-placeholder.png)

---

## Who Is This For?

CHAOS GRID is built for power users who run multiple Claude Code (or similar CLI) sessions daily and want to see them all at once, coordinate them, and understand how their work flows across research, thinking, and shipping.

If you regularly run `claude --dangerously-skip-permissions` across several projects, this tool gives you a single pane of glass with orchestration built in.

## What Makes It Different

Most terminal multiplexers (tmux, Zellij) manage shells. CHAOS GRID manages AI agent sessions with purpose:

- **Structured grid, not arbitrary splits.** Each cell has a name, a theme, and a role in your workflow. The grid maps to three knowledge work layers -- Stimulus (research/input), Will (thinking/deciding), Supply (shipping/output).
- **Parallel launch and broadcast.** Start agents in all cells at once. Send the same prompt to every running agent simultaneously.
- **Flow diagnosis.** A built-in CONTROL mode calls an LLM to analyze all terminal outputs and diagnose where Stimulus to Will to Supply conversion is stuck.
- **Session awareness.** Tracks per-cell cost, auto-restarts exited agents, queues follow-up prompts, and restores sessions across app restarts.

## The Three Layers

| Layer | Role | Grid Column |
|-------|------|-------------|
| **Stimulus** | Receive from outside -- research, reading, exploration | Right |
| **Will** | Convert to personal intent -- thinking, deciding, synthesizing | Center |
| **Supply** | Create and ship -- writing, coding, publishing | Left |

```
+----------+----------+----------+
|  Supply  |   Will   | Stimulus |
+----------+----------+----------+
|  agent   |  agent   |  agent   |
+----------+----------+----------+
|  agent   |  agent   |  agent   |
+----------+----------+----------+
```

## Recommended Setup

CHAOS GRID launches CLI tools with full permissions by design. To contain blast radius:

- **Use git worktrees** for each cell pointing to the same repo, so agents do not conflict on file writes.
- **Use sandbox/scratch repos** for exploratory Stimulus cells.
- **Set a dedicated output directory** per column via Settings, so each agent writes to an isolated path.
- **Review agent output** before accepting large-scale changes. The grid view makes this easy.

## Features

- Configurable terminal grid -- up to 6x5 real PTY terminals (30 cells), each named and themed
- LAUNCH ALL -- sends the configured CLI command to all terminals at once
- Broadcast -- type once, send to all active agents simultaneously
- OS notifications -- get notified when an agent needs your input
- Session cost tracking -- per-cell cumulative cost parsed from Claude Code output
- Auto-restart -- cells automatically relaunch the agent after exit
- Task queue -- pre-queue prompts per cell; auto-send on agent exit
- Session restore -- relaunch all cells on next startup from saved session
- Grid presets -- save and load grid/tool configurations by name
- Keyboard navigation -- Cmd+1-9 to focus cells, Cmd+Shift+L/R/G/C for global shortcuts
- Drag-to-resize columns and cell heights
- CONTROL mode -- AI analyzes all terminals and diagnoses the flow

## Requirements

- macOS (primary target; Windows untested)
- [Rust](https://rustup.rs/) 1.77+
- Node.js 18+
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) -- `npm i -g @anthropic-ai/claude-code`
- Optional: Gemini/OpenAI/Anthropic API key for the CONTROL analysis feature

## Setup

```bash
git clone https://github.com/onoz1169/chaos-grid.git
cd chaos-grid
npm install
npm run dev
```

For a production build:

```bash
npm run build
cp -r src-tauri/target/release/bundle/macos/chaos-grid.app /Applications/
```

API keys can be configured in the Settings panel inside the app, or via environment file:

```bash
# ~/.chaos-grid.env
GEMINI_API_KEY=your_key_here
```

## Usage

| Action | How |
|--------|-----|
| Launch agent in all cells | Click LAUNCH ALL or `Cmd+Shift+L` |
| Launch agent in one cell | Click the play button in the cell header |
| Send text to all active agents | Type in the Broadcast field and press Enter |
| Focus a specific cell | `Cmd+1` through `Cmd+9` |
| Switch to grid view | `Cmd+Shift+G` |
| Switch to control view | `Cmd+Shift+C` |
| Reset all sessions | Click RESET ALL or `Cmd+Shift+R` |
| Rename a theme | Double-click the theme label in the cell header |
| Hide a cell | Click the close button in the cell header |
| Queue tasks per cell | CONTROL mode, Tasks tab |
| Analyze the flow | CONTROL mode, click Analyze |

## Settings

All settings are accessible via the gear button in the top bar.

| Setting | Description |
|---------|-------------|
| Presets | Save/load named grid configurations |
| Output Directory | Working directory root for each cell |
| CLI Tool | `claude`, `codex`, or any custom command |
| Grid Size | Rows (1-6) x Columns (1-5) |
| AI Language | Language for auto-naming and analysis output |

## Stack

- [Tauri v2](https://v2.tauri.app/) -- Rust backend + system WebView
- [React](https://react.dev/) + TypeScript
- [xterm.js](https://xtermjs.org/) -- terminal emulation
- [portable-pty](https://github.com/wez/wezterm/tree/main/pty) -- real PTY process management
- [tauri-plugin-notification](https://github.com/tauri-apps/plugins-workspace) -- OS notifications

## License

MIT
