# CHAOS GRID

A 9-terminal manager that visualizes the flow of knowledge work.

```
┌──────────────┬──────────────┬──────────────┐
│    Supply    │     Will     │   Stimulus   │
│  (ship it)  │ (make it yours)│ (take it in) │
├──────────────┼──────────────┼──────────────┤
│  claude code │  claude code │  claude code │
├──────────────┼──────────────┼──────────────┤
│  claude code │  claude code │  claude code │
├──────────────┼──────────────┼──────────────┤
│  claude code │  claude code │  claude code │
└──────────────┴──────────────┴──────────────┘
                  ↓ [Analyze]
     AI scans all 9 terminals at once.
     Finds where the flow is blocked.
     Tells you exactly what to do next.
```

## The Idea

Knowledge work has three layers:

| Layer | Role | Column |
|-------|------|--------|
| **Stimulus** | Receive from outside — research, reading, exploration | Right |
| **Will** | Convert to personal intent — thinking, deciding, synthesizing | Center |
| **Supply** | Create and ship — writing, coding, publishing | Left |

Assign themes to each cell, run Claude Code in all of them, and let the Command AI (Gemini) diagnose where the flow from Stimulus → Will → Supply is breaking down.

## Features

- **3×3 terminal grid** — 9 real PTY terminals, each with a named theme
- **LAUNCH ALL** — sends `claude --dangerously-skip-permissions` to every terminal at once
- **COMMAND mode** — Gemini analyzes all active terminals and diagnoses the Stimulus → Will → Supply flow
- **Session persistence** — cell outputs and analysis history survive app restarts
- **Auto-analyze timer** — trigger analysis automatically every 1 / 3 / 5 / 10 minutes

## Requirements

- macOS or Windows
- [Rust](https://rustup.rs/) 1.77+
- Node.js 18+
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — `npm i -g @anthropic-ai/claude-code`
- [Gemini API key](https://aistudio.google.com/apikey) (free tier available)

## Setup

```bash
git clone https://github.com/onoz1169/chaos-grid.git
cd chaos-grid
npm install
cp .env.example .env
# Add your Gemini API key to .env
npm run dev
```

`.env`:
```
GEMINI_API_KEY=your_key_here
```

## Usage

| Action | How |
|--------|-----|
| Launch Claude in all terminals | Click **⚡ LAUNCH ALL** |
| Launch Claude in one terminal | Click **▶** in the cell header |
| Analyze the flow | Switch to **COMMAND** mode → click **⟳ Analyze** |
| Auto-analyze | Set the timer in the top bar (1 / 3 / 5 / 10 min) |
| Rename a theme | Double-click the theme label in the cell header |
| Kill a terminal | Click **✕** in the cell header |

## Stack

- [Tauri v2](https://v2.tauri.app/) — Rust backend + system WebView (lightweight, cross-platform)
- [React](https://react.dev/) + TypeScript
- [xterm.js](https://xtermjs.org/) — terminal emulation
- [portable-pty](https://github.com/wez/wezterm/tree/main/pty) — real PTY process management
- [Gemini 2.5 Flash](https://ai.google.dev/) — Command analysis engine

## License

MIT
