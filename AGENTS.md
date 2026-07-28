## Commands

- `pnpm dev` — dev server (don't start without asking)
- `pnpm check` — typecheck + lint in parallel (run after every change)
- `pnpm lint` / `pnpm typecheck` — individual checks
- `pnpm build` / `pnpm start` — production build & start

## Architecture

**Stack**: Next.js 16 (App Router) + React 19 + Tailwind CSS v4 + TypeScript.

**React Compiler**: enabled (`reactCompiler: true`). Do NOT use `useMemo`, `useCallback`, or `React.memo`.

**UI components**: shadcn/ui-style, built on `@base-ui/react`. Located at `src/components/ui/`.

**Formatting**: Prettier (no semi, single quotes, trailing comma none, printWidth 100).

**Font**: system CJK fonts (PingFang SC / Microsoft YaHei) + Geist Mono (monospace). CSS vars: `--font-sans`, `--font-mono`, `--font-heading`.

## Data flow

**Configuration** (`src/lib/config.ts`): persisted via `conf` npm package on the server side. Types: `ServiceConfig` (id, name, projectDir, backendHost, backendPort, frontendPort), `ProjectDir` (name, path).

**Service process** (`src/lib/service-process.ts`): spawns `vite dev` via child_process. Detects package manager (pnpm/yarn/npx) per project. Logs captured via pipe, FORCE_COLOR=1 enables ANSI, rendered client-side by `anser`.

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

- SSE connects once per page session. Never add manual `connect()`/`disconnect()`.
- `pnpm check` must pass before committing.
- Tailwind is v4; uses `@tailwindcss/postcss` plugin, CSS-first config (no `tailwind.config.*`).
