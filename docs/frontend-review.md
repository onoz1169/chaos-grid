# Frontend Component Review - chaos-grid

Date: 2026-03-06

## File Size Check

All files are under 500 LOC. Largest files:
- TopBar.tsx: 324 lines
- Grid.tsx: 301 lines
- OutputView.tsx: 255 lines
- TaskQueue.tsx: 242 lines

---

## Issues

| # | File | Issue | Category | Priority | Fix Proposal |
|---|------|-------|----------|----------|--------------|
| 1 | Cell.tsx (L84-135) | Terminal effect has `eslint-disable` for exhaustive deps. `compact`, `userSubmittedRef`, `rawOutputRef`, `workDir`, `toolCmd` are missing from deps. If these props change after mount, Terminal will not reflect new values. Specifically `term.onData` closes over stale `userSubmittedRef` and `rawOutputRef` if Cell is not remounted. | Bug | High | Either add deps and handle cleanup properly (dispose+recreate terminal), or document why these refs are stable. The refs themselves are stable (useRef), so the real risk is `compact` (fontSize) not updating. |
| 2 | Cell.tsx (L62-75) | Auto-restart uses dynamic `import('@tauri-apps/api/event')` inside useEffect every render cycle that creates the effect. The listener registers per-cell and filters by cellId, but does not depend on `autoRestart` state -- instead reads `localStorage` directly at event time. This is intentional but fragile: the React state `autoRestart` and localStorage can diverge if another tab/window changes it. | Design smell | Low | Acceptable workaround. Consider using a ref instead of localStorage read for consistency. |
| 3 | Grid.tsx (L67-71) | `cellDivRefs.current` refs are created inside render body (not inside useEffect/useMemo). `createRef()` is called on every render for every cellId, replacing old refs. This means refs are recreated each render, which is wasteful and could cause the focus effect (L73-79) to fail if timing is off. | Performance / Bug | High | Use a stable `useRef<Map>` or `useCallback` ref pattern instead of calling `createRef()` in the render body. |
| 4 | Grid.tsx (L86-87, L102-105) | `colSizes` and `cellSizes` are stored via `useLocalStorage` but the reset effect (L102-105) has `eslint-disable` and omits `setColSizes`, `setCellSizes`, `gridCols` from deps. When `gridCols` changes and `resetKey` stays the same, sizes won't reset. | Bug | Medium | Add `gridCols` to dependency array of the reset effect, or merge with the sync effect at L108-114. |
| 5 | Grid.tsx (L45-61) | `GridInner` props interface is duplicated inline as an anonymous type instead of reusing `GridProps` (minus `viewMode`). 16 lines of redundant type definitions. | Code quality | Low | Extract `Omit<GridProps, 'viewMode'> & { compact?: boolean }` or define a shared interface. |
| 6 | OutputView.tsx (L46) | `language` is read directly from `localStorage.getItem()` instead of using the `language` prop/state from App. This bypasses React state and could show stale language if the user changes language in the same session without reload. | Bug | Medium | Pass `language` as a prop from App.tsx, or use the existing `useLocalStorage` hook. |
| 7 | OutputView.tsx (L112-123) | Auto-refresh interval (30s) creates new `invoke` calls for every genre on each tick, but does not cancel in-flight promises when the component unmounts or genres change. Race conditions can cause stale data to overwrite fresh data. | Bug | Medium | Use an AbortController pattern or track a `mounted` flag to discard stale results. |
| 8 | OutputView.tsx (L154-161) | `autoSummarizedRef` is never reset. If genres change completely (e.g., user changes output directory), auto-summarize will not trigger again because the ref stays `true`. | Bug | Medium | Reset `autoSummarizedRef.current = false` when genre signature changes. |
| 9 | TopBar.tsx (full file) | Massive inline style objects throughout (L80-321). Every render creates dozens of new style objects. The settings panel alone has 15+ inline style objects. | Performance | Medium | Extract common styles as constants (like `inputStyle` in AiSettings.tsx), or use CSS classes. |
| 10 | TopBar.tsx (L119-121, L173-174, L224-225) | `onFocus`/`onBlur` handlers directly mutate `e.currentTarget.style`. This bypasses React's rendering model and won't reset if the component re-renders while focused. | Code quality | Low | Use CSS `:focus` pseudo-class instead, or manage focus state via useState. |
| 11 | App.tsx (L149-151) | `activeCells` is computed on every render by filtering `cellActivity` values against `Date.now()`. Since `Date.now()` changes every call, this value can be stale (shows 2-minute-old activity as "active"). No timer forces re-evaluation, so the count only updates when other state changes trigger a re-render. | Bug | Medium | Add a `setInterval` to periodically force re-render, or use a dedicated timer-based hook. |
| 12 | App.tsx (L125-136) | Session save effect fires on every `cellStates` change. If cells update rapidly (frequent pty output changing state), this calls `invoke('save_session_state')` at high frequency. | Performance | Medium | Debounce the save call (e.g., 5-second debounce). |
| 13 | TaskQueue.tsx (L42-57) | The `listen` effect has an empty dependency array `[]`, which means it captures the initial `loadTasks` closure. However, `loadTasks` reads from localStorage directly (not React state), so this is safe. But `setTasks` is called without referencing the latest state from the event -- it always reads from localStorage via `loadTasks`. This double-source-of-truth (React state + localStorage) can lead to inconsistency. | Design smell | Medium | Use a single source of truth. Either always read from localStorage (no React state) or always use React state and sync to localStorage via effect. |
| 14 | TaskQueue.tsx (L35-39) | The sync effect writes ALL cellIds' tasks to localStorage on every `tasks` state change, even if only one cell's queue changed. | Performance | Low | Only persist the changed cell's tasks, or debounce the sync. |
| 15 | CellHeader.tsx (L31) | Very long function signature (single line, 200+ chars). Hard to read. | Code quality | Low | Break props into multiple lines. |
| 16 | Cell.tsx (L50-59) | CPU polling every 2s per cell. With a 6x5 grid (30 cells), this is 30 invoke calls every 2 seconds. | Performance | Medium | Batch CPU polling into a single backend call (e.g., `get_all_cell_cpu`), or increase interval for non-focused cells. |
| 17 | GitPanel.tsx (L70) | useEffect depends on `selectedGenre?.name` which is unstable -- accessing optional chain in dep array. If `selectedGenre` is undefined, `name` is undefined. This works in practice but is not idiomatic. | Code quality | Low | Use a derived variable: `const genreName = selectedGenre?.name ?? null` and depend on that. |
| 18 | DashboardView.tsx / OutputView.tsx | Inline style objects are pervasive across the entire codebase. Almost every element has 5-15 CSS properties defined inline. This creates new objects on every render and makes the code harder to maintain. | Performance / Maintainability | Medium | Introduce a shared style constants file or use CSS modules. At minimum, extract repeated patterns (monospace font stack, dark backgrounds, border colors). |
| 19 | AiSettings.tsx (L87-99) | `handleSave` is not wrapped in `useCallback`. Minor, but inconsistent with the rest of the codebase. Also uses `alert()` for error handling, which blocks the UI. | UX / Code quality | Low | Use `useCallback` with proper deps. Replace `alert()` with an inline error message. |
| 20 | Cell.tsx (L108-112) | `spawn_pty` is called once via `spawnedRef`, but if the component unmounts and remounts (e.g., grid resize), `spawnedRef` resets and a new PTY is spawned without killing the old one, potentially causing orphaned processes. | Bug | High | Track spawned state per cellId (e.g., in a module-level Set or via the backend), or ensure PTY cleanup on unmount. |
| 21 | App.tsx (L83-89) | `handleBroadcast` sends messages sequentially with `for...of` + `await`. If many cells are active, this creates visible latency. | Performance / UX | Low | Use `Promise.all` to send in parallel. |
| 22 | Grid.tsx (L296-298) | Control view (`OutputView`) is conditionally rendered (not just hidden like grid view). Switching from control to grid and back destroys and recreates the entire OutputView component, losing all local state (selected file, scroll position, etc.). | UX | Medium | Use `display: none` pattern like grid view to preserve state, or lift relevant state up. |
| 23 | SessionRestoreDialog.tsx (L31) | If `checked` is true but `session` is null or has no entries, returns `null`. But `showRestoreDialog` in App.tsx stays `true`, meaning the dialog component keeps rendering (returning null) on every App re-render. | Performance | Low | Call `onDismiss` when session is empty/null to clean up parent state. |

## Summary

- **High priority (3)**: Stale refs in Cell terminal setup (#1), unstable createRef in render (#3), orphaned PTY processes on remount (#20)
- **Medium priority (9)**: Session save flooding (#12), stale active cell count (#11), double source of truth in TaskQueue (#13), inline styles everywhere (#9, #18), OutputView state loss on view switch (#22), auto-summarize one-shot (#8), race condition in auto-refresh (#7), localStorage language read (#6), Grid reset deps (#4)
- **Low priority (11)**: Various code quality and minor performance issues

The most impactful improvements would be:
1. Fix Cell.tsx PTY lifecycle (issues #1, #20) -- risk of orphaned processes and stale closures
2. Fix Grid.tsx ref creation pattern (#3) -- renders are wasteful and focus may break
3. Add debouncing to session save (#12) and batch CPU polling (#16) -- reduces unnecessary IPC
4. Preserve OutputView state across view switches (#22) -- significant UX improvement
