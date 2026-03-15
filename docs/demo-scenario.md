# chaos-grid Demo Scenario

## Core Message

Running multiple projects at once is chaos.
You don't stop it. You control it.

**"Embrace the chaos. Control the grid."**

---

## Grid Layout (3×3)

```
┌──────────────────┬──────────────────┬──────────────────┐
│     SUPPLY       │      WILL        │    STIMULUS      │
│  (client work)   │  (your product)  │  (what's next)   │
├──────────────────┼──────────────────┼──────────────────┤
│  client-api      │  chaos-grid      │  market-watch    │
├──────────────────┼──────────────────┼──────────────────┤
│  client-frontend │  will-log        │  paper-digest    │
├──────────────────┼──────────────────┼──────────────────┤
│  client-infra    │  localcode       │  competitor-scan │
└──────────────────┴──────────────────┴──────────────────┘
```

**Supply** — Client work. Stuff you were hired to build.
**Will** — Your own products. Stuff you actually want to build.
**Stimulus** — Research. The raw material for your next big idea.

---

## Demo Flow

### STEP 1: Launch everything at once

**Action:** Click **⚡ LAUNCH ALL** (or `Cmd+Shift+L`)

All 9 cells start Claude Code simultaneously.
Supply agents load client repos. Will agents pick up where you left off.
Stimulus agents start pulling in data.

---

### STEP 2: Give each cell its own instructions

Each cell gets different work — so you click through them one by one.

---

#### Supply — client-api

```
The Stripe webhook handler is missing retry logic for failed payments.
Implement it with exponential backoff. Add tests.
```

#### Supply — client-frontend

```
The dashboard is too slow to load. Users are complaining.
Add skeleton UI to improve perceived performance.
```

#### Supply — client-infra

```
Review the production Dockerfile.
Remove unnecessary layers and reduce build time.
Report what you find before making changes.
```

---

#### Will — chaos-grid

```
The CONTROL mode output parser uses string matching.
Refactor it to structured parsing so we can extract
agent state, cost, and file changes reliably.
Design first, then implement.
```

#### Will — will-log

```
Implement the `will reflect` command.
It should pull the last 7 days of journal entries,
send them to the Claude API, and generate
3 questions that push me to reflect deeper.
```

#### Will — localcode

```
`lc run` output is getting buffered and showing up late.
Switch to PTY streaming instead. The delay kills the UX.
```

---

#### Stimulus — market-watch

```
Research the top AI agent management tools gaining traction in 2026.
Focus on solo developer tools and OSS projects.
Save a summary to docs/research/agent-tools-2026.md
```

#### Stimulus — paper-digest

```
Search arXiv for "multi-agent coordination 2025 2026".
Pick 3 papers with practical implementation ideas.
Summarize each in 5 bullets. Save to docs/research/papers.md
```

#### Stimulus — competitor-scan

```
Check the latest commits on claude-squad and ccmanager this week.
What features did they ship? Anything we should react to?
```

---

### STEP 3: Let chaos run — respond when needed

While all 9 agents work in parallel, you do other things.

OS notifications fire when an agent needs your input.

- `client-api` → "Stripe retry logic done. Ready for review."
- `chaos-grid` → "Design proposal ready. Approve before I implement?"

**Action:** `Cmd+2` to jump to that cell. Review. Reply. Move on.

---

### STEP 4: Switch to CONTROL — see the whole picture

**Action:** `Cmd+Shift+C`

CONTROL mode shows all agent outputs at a glance.
Click **Analyze** and the AI reads everything:

```
Supply: client-api is complete, waiting for your review.
        client-infra found 3 issues, no changes made yet.

Will:   chaos-grid is in design phase — this is the most complex task.
        will-log is making API calls, almost done.

Stimulus: market-watch finished. Strong signal on agent-coordination tools.
          This could feed directly into chaos-grid's next feature.
```

---

## Video Script (90 seconds)

| Time | Visual | Line |
|------|--------|------|
| 0:00–0:08 | Empty grid, 9 dark cells | "Running multiple projects at once is chaos." |
| 0:08–0:18 | LAUNCH ALL → 9 cells fire up | "You don't stop it." |
| 0:18–0:45 | Clicking through cells, typing different instructions in each | "Supply is client work. Will is what you want to build. Stimulus is what comes next. Give each agent a role." |
| 0:45–1:05 | Agents working in parallel, OS notification pops | "They run. You stay in control." |
| 1:05–1:25 | CONTROL mode, AI analysis output | "When you need to zoom out — CONTROL mode shows you everything." |
| 1:25–1:35 | Back to grid, all cells active | "Nine agents. Three roles. One grid." |
| 1:35–1:45 | Text on screen | "Embrace the chaos. Control the grid." |

---

## Catchphrases

**Hero line:**
> Embrace the chaos. Control the grid.

**Supporting lines:**
> Nine agents. Three roles. One grid.
> Ship for clients. Build for yourself. Research what's next. All at once.
> Chaos isn't the problem. Losing track of it is.

---

## Target Viewer

A solo developer or indie hacker who:
- Already uses Claude Code or AI coding agents
- Has more work than they can handle linearly
- Feels the tension between client work and personal projects
- Has thought "I wish I could run all of this at once"

They watch this and think: *"That's exactly what I need."*
