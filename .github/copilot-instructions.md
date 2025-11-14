# Copilot / Agent Instructions — TaskGlitch

Short, actionable guidance so an AI coding agent can be productive in this repo.

Quick start
- **Run dev server:** `npm run dev` (uses Vite).
- **Build:** `npm run build` (runs `tsc -b` then `vite build`).
- **Preview production build:** `npm run preview`.

Project high-level architecture
- `src/App.tsx` is the top-level UI: it wraps `UserProvider` and `TasksProvider` and composes the dashboard.
- State layer: `src/context/TasksContext.tsx` exposes task operations from the hook `src/hooks/useTasks.ts`.
- UI: presentational and container components live in `src/components/` (e.g. `TaskTable`, `MetricsBar`, `ChartsDashboard`).
- Business logic & analytics: `src/utils/logic.ts` contains derived metrics, sorting and analytics helpers used across the UI.
- Data source: static JSON in `public/tasks.json`. The app uses this as the primary seed and falls back to `src/utils/seed.ts`.

Key integration points and patterns
- Path alias: the project uses `@/*` -> `src/*` (see `tsconfig.json` and `vite.config.ts`). Use `@/` imports when adding files.
- Context contract: consumers call `useTasksContext()` for `{ tasks, derivedSorted, metrics, addTask, updateTask, deleteTask, undoDelete }` (see `TasksContext.tsx`).
- Add/update/delete flow examples:
  - Add: call `addTask({ title, revenue, timeTaken, priority, status })` — implemented in `useTasks.ts` and auto-generates `id` and timestamps.
  - Update: call `updateTask(id, patch)` — `useTasks` will set `completedAt` when status changes to `Done` and ensure `timeTaken > 0`.
  - Delete/Undo: `deleteTask(id)` sets `lastDeleted`; `undoDelete()` re-inserts it (used by `UndoSnackbar.tsx`).

Discoverable gotchas and repo-specific behavior
- Data loading: `useTasks` fetches `/tasks.json` then normalizes rows (`normalizeTasks`). It also contains an intentional code comment about appending malformed rows under some runs — check lines in `src/hooks/useTasks.ts` if you see odd data.
- Double-fetch race: `useTasks` has a delayed second fetch that can append duplicates on fast remounts — if duplicates appear, inspect the second `useEffect` in `useTasks.ts`.
- Sorting stability: `src/utils/logic.ts`'s `sortTasks` currently uses a randomized tiebreaker. Fixing deterministic ordering requires replacing the random fallback.
- ROI calculation: `computeROI` permits non-finite and divide-by-zero values; callers (e.g. UI) often filter using `Number.isFinite` — be careful when changing this logic.

Editing and adding code guidance
- UI changes: modify or add components under `src/components/`. Keep MUI patterns (the project uses `@mui/material` + emotion).
- Logic/analytics changes: update `src/utils/logic.ts`. Unit-test any numeric changes against the static `public/tasks.json` or the seed generator.
- Hooks/context: prefer changing behavior inside `src/hooks/useTasks.ts` and keep `TasksContext.tsx` as a thin provider.

Debugging tips
- Run `npm run dev` and open the browser console — fetch errors for `/tasks.json` are surfaced in the hook.
- To reproduce seed/fallback behavior, temporarily console.log in `useTasks` after normalization.
- For type errors, run `npx tsc -p .` or `npm run build` (build runs typecheck via `tsc -b`).

Conventions & expectations
- TypeScript `strict: true` is enabled. Keep types precise and update `src/types.ts` for shared shapes.
- Use the `@/` alias for imports instead of relative paths when code is in `src/`.
- UI uses MUI v6 patterns; prefer MUI components and theme values from `src/theme.ts` for consistency.

Files worth reading first
- `src/hooks/useTasks.ts` — data lifecycle, normalization and known race/bugs.
- `src/utils/logic.ts` — all metrics, sorting and derived helpers.
- `src/components/TaskTable.tsx` & `src/components/TaskForm.tsx` — typical task CRUD UI patterns.
- `public/tasks.json` — canonical dataset for manual verification.

If unsure
- Ask: “Should I fix the non-deterministic sort and the double-fetch?” or “Do you want malformed-row normalization added?”
- When adding analytics, include a small unit test or reproducible example using `public/tasks.json`.

End of instructions — please tell me which sections to expand or any conventions you want enforced.
