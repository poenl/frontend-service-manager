## Commands

- 禁止执行构建命令（如 `pnpm build`、`next build`）：任何情况下都不得运行构建类命令，除非用户明确要求。

- `pnpm dev` — dev server (don't start without asking)
- `pnpm check` — typecheck + lint in parallel (run after every change)
- `pnpm lint` / `pnpm typecheck` — individual checks
- `pnpm build` — production build (standalone output). Static & public assets are staged into `.next/standalone/` by `scripts/manage.mjs stage`, invoked via `prepack` (not by a bare `pnpm build`)
- `pnpm link` — one-time global link so the `fsm` command is available on PATH
- `fsm stage|start|stop|status|log` — manage the standalone production daemon (start/stop/status/log; `stage` is invoked via `prepack`). `fsm start` is build-free; if the artifact is missing, run `pnpm build` then `node scripts/manage.mjs stage`. `fsm start --port <n>` overrides the listen port (default 3000); status reads the recorded port
- `npm publish` — runs `prepack` (`pnpm build && node scripts/manage.mjs stage`), then publishes the standalone package (files: `.next/standalone`, `scripts`; no source)

## Architecture

**Stack**: Next.js 16 (App Router) + React 19 + Tailwind CSS v4 + TypeScript.

**React Compiler**: enabled (`reactCompiler: true`). Do NOT use `useMemo`, `useCallback`, or `React.memo`.

**UI components**: shadcn/ui-style, built on `@base-ui/react`. Located at `src/components/ui/`.

**Formatting**: Prettier (no semi, single quotes, trailing comma none, printWidth 100).

**Font**: system CJK fonts (PingFang SC / Microsoft YaHei) + Geist Mono (monospace). CSS vars: `--font-sans`, `--font-mono`, `--font-heading`.

## Data flow

**Configuration** (`src/lib/config.ts`): persisted via `conf` npm package on the server side. Types: `ServiceConfig` (id, name, projectDir, backendHost, backendPort, frontendPort), `ProjectDir` (name, path).

**Service process** (`src/lib/service-process.ts`): spawns `vite dev` via child_process. Detects package manager (pnpm/yarn/npx) per project. Logs captured via pipe, FORCE_COLOR=1 enables ANSI, rendered client-side by `anser`. On daemon exit (SIGTERM/SIGINT) a cleanup hook stops all running child services so they don't linger as orphan processes.

**Real-time events**: in-process `EventBus` (`lib/service-events.ts`) → SSE stream (`/api/service/events`). Events: `snapshot` (init), `status`, `log`, `paused`, `services` (full list), `project-dirs` (full list). Config mutations emit the full-list event, not granular.

**SSE client** (`src/lib/sse-client.ts`): singleton, auto-connects on first `on()` call. DO NOT call connect/disconnect — use `useSSE()` hook instead. Notification permission (`requestPermission()`) auto-requested on first connect.

**Client state** (`src/lib/use-service-manager.ts`): shared hook for service list, running status, logs, CRUD operations. Used by both `page.tsx` (home → `/service/[id]` auto-redirect) and `service/[id]/page.tsx`.

**Access control**: settings page (`/settings`) and its API routes are restricted to localhost via `src/proxy.ts` middleware.

## API routes

| Method              | Route                                  | Purpose                                |
| ------------------- | -------------------------------------- | -------------------------------------- |
| GET/POST            | `/api/service`                         | list/create services                   |
| GET/PUT/DELETE      | `/api/service/[id]`                    | get/update/delete (DELETE stops first) |
| POST                | `/api/service/[id]/start\|/[id]/stop`  | start/stop a service                   |
| GET                 | `/api/service/[id]/status\|/[id]/logs` | status/logs                            |
| POST                | `/api/service/pause\|/resume`          | pause/resume all                       |
| GET                 | `/api/service/events`                  | SSE stream                             |
| GET/POST/PUT/DELETE | `/api/settings/project-dirs`           | project directories                    |

Running services block editing of `projectDir`, `backendHost`, `backendPort`, `frontendPort`.

## Notifications

Browser Notification API. Only fires when `document.visibilityState === 'hidden'`. Click → `window.focus()`.

## Cautions

- 兼容主流桌面端与运行时：代码须兼容主流桌面端（macOS / Windows / Linux）与主流运行时（Node.js / bun）；使用平台相关命令或依赖前，须先确认替代方案（如避免依赖 `tail` 等非跨平台命令），或提供降级/条件处理。
- SSE connects once per page session. Never add manual `connect()`/`disconnect()`.
- `pnpm check` must pass before committing.
- Tailwind is v4; uses `@tailwindcss/postcss` plugin, CSS-first config (no `tailwind.config.*`).
