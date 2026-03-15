# Review: Shared Types, Custom Hooks, Utilities

Date: 2026-03-06

## Review Summary

| # | File | Problem | Priority | Proposed Fix |
|---|------|---------|----------|--------------|
| 1 | `src/shared/types.ts` | `CELL_IDS` / `COL_LABELS` are exported but never imported anywhere. "kept for backward compat" comment, but no consumer exists. | Low | Remove or mark `@deprecated`. Dead code increases surface area. |
| 2 | `src/shared/types.ts` | `AnalyzeResult` / `FlowAnalysis` are exported but not imported anywhere in `src/`. | Medium | If used only by Tauri backend (Rust side), move to a shared schema. Otherwise remove. |
| 3 | `src/shared/types.ts` | `CellRole` type is exported but never imported as a type -- only `getCellRole` function is used. | Low | Keep for now (useful for documentation), but confirm no one needs it standalone. |
| 4 | `src/shared/types.ts` | `roleColor()` function and `ROLE_COLORS` constant are both exported. CellHeader imports `ROLE_COLORS` directly and creates a local `roleColor` variable, while Grid/OutputView/DashboardView use the `roleColor()` function. Inconsistent usage pattern. | Medium | Standardize on one: either always use `roleColor()` helper, or always use `ROLE_COLORS` direct access. The helper is safer (has fallback `#888`). |
| 5 | `src/shared/types.ts` | `getCellRole` mixes data logic (column-to-role mapping) with type definitions in the same file. The file is both a type definition module and a business logic module. | Low | Consider splitting: `types.ts` for interfaces/types, `grid-logic.ts` for functions like `getCellRole`, `getCellIds`, `getColLabels`, `cellWorkDir`. |
| 6 | `src/shared/types.ts` | `ROLE_COLORS` typed as `Record<string, string>` instead of `Record<CellRole, string>`. Loses type safety -- any arbitrary string key is accepted without error. | Medium | Change to `Record<CellRole, string>`. |
| 7 | `src/renderer/src/utils/status.ts` | `STATUS_DOT` / `STATUS_COLOR` typed as `Record<string, string>` instead of `Record<CellState['status'], string>`. Same type safety issue as #6. | Medium | Use `Record<CellState['status'], string>` (CellHeader already does this for its local `STATUS_COLORS`). |
| 8 | `src/renderer/src/utils/status.ts` + `CellHeader.tsx` | Duplicate status color definitions. `status.ts` defines `STATUS_COLOR` (used in DashboardView). `CellHeader.tsx` defines its own local `STATUS_COLORS` with identical values (but different key for idle: `#444` vs `#333`). | High | Consolidate to single source. The idle color discrepancy (`#333` in status.ts vs `#444` in CellHeader) is likely a bug. |
| 9 | `src/renderer/src/hooks/usePtyOutput.ts` | `rawOutputRef.current` grows unbounded during auto-naming phase. If naming never triggers (threshold not reached but output keeps accumulating), the string keeps growing. | Medium | Cap `rawOutputRef.current` length or clear it after naming completes (partially addressed in `resetNaming`, but only called externally). |
| 10 | `src/renderer/src/hooks/usePtyOutput.ts` | `parseCost` accumulates costs via `sessionCostRef.current += cost`, but `sessionCostRef` is never reset. If a cell is restarted within the same component lifecycle, cost carries over from previous session. | Low | Provide a `resetCost` callback or reset on cell restart event. |
| 11 | `src/renderer/src/hooks/usePtyOutput.ts` | `localStorage.getItem('chaos-grid-language')` is called inside the Tauri event listener (line 145). Accessing localStorage synchronously in a high-frequency event callback is a minor perf concern and couples the hook to a specific localStorage key. | Low | Read the language value outside the listener (e.g., via a ref updated from props or context). |
| 12 | `src/renderer/src/hooks/usePtyOutput.ts` | The `listen` call on line 89 registers the callback immediately, but `unlistenFn` is only set in the `.then()` callback (line 163). If events fire before the promise resolves, they are handled -- but if the component unmounts before `.then()` runs, the `mounted` flag handles cleanup. This is correct but fragile; a race condition could cause a brief leak if `listen` resolves slowly. | Low | Pattern is acceptable for Tauri. Document the race condition reasoning. |
| 13 | `src/renderer/src/hooks/usePtyOutput.ts` | `setDetectedPort(port)` is called on every PTY data event even when the value hasn't changed (port detection runs on every chunk). Triggers unnecessary re-renders. | Medium | Guard with `if (port !== detectedPort)` using a ref, similar to the `waitingRef` pattern already used for `waiting`. |
| 14 | `src/renderer/src/hooks/useLocalStorage.ts` | The `key` parameter is a dependency of `useCallback` for `set`, but if `key` changes at runtime, the old key's data remains in localStorage (stale entry). | Low | This is acceptable if keys are always static (which they appear to be in current usage). Add a comment documenting this assumption. |
| 15 | `src/renderer/src/hooks/useLocalStorage.ts` | No SSR guard for `localStorage` access. Not an issue for Tauri (always has window), but limits reusability. | Low | Not actionable for this project. Note for future extraction. |
| 16 | `src/renderer/src/utils/files.ts` | `timeAgo` function name conflicts with `GitCommit.timeAgo` and `ActivityEntry.timeAgo` field names in `output-types.ts`. The function computes from milliseconds, while the fields contain pre-formatted strings from the backend. Naming collision could cause confusion. | Low | Rename function to `formatTimeAgo` or rename the fields to `timeAgoStr` / `relativeTime`. |
| 17 | `src/renderer/src/utils/output-types.ts` | `GenreInfo` has fields `role` (string) and `cellId` (string) that could reference the shared `CellRole` type and a branded cell ID type for stronger typing. | Low | Use `CellRole` from shared types for the `role` field. |
| 18 | `src/renderer/src/utils/files.ts` | `extColor` uses hardcoded color map with no connection to theme system. If the app adds theming, these will need to be updated independently. | Low | Acceptable for current scope. No action needed now. |

## Summary by Priority

- **High (1)**: #8 -- Duplicate and inconsistent status color definitions across files.
- **Medium (5)**: #2, #4, #6, #7, #9, #13 -- Type safety gaps, inconsistent patterns, potential perf issue.
- **Low (12)**: Remaining items -- Minor naming, dead code, defensive coding suggestions.

## Key Observations

1. **Type safety**: Several `Record<string, string>` definitions should use union types that already exist (`CellRole`, `CellState['status']`). This is the most impactful class of issue.

2. **Dead exports**: `CELL_IDS`, `COL_LABELS`, `AnalyzeResult`, `FlowAnalysis` have no importers. These should be confirmed as unused and removed.

3. **Hooks quality**: `usePtyOutput` is well-structured with proper cleanup and ref-based callback patterns. The main concerns are unbounded buffer growth and unnecessary re-renders from `setDetectedPort`.

4. **useLocalStorage**: Clean implementation. The `Updater<T>` pattern correctly mirrors React's `useState` API.

5. **Utility functions**: `files.ts` utilities are simple and correct. No edge case issues found.
