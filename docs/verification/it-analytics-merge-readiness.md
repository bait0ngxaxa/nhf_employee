# IT analytics correction — release verification

Date: 2026-11-07. Branch: `feat/it-ticket-analytics-dashboard`; base: `main`.
Reviewed starting HEAD: `2278be0c`. The remote feature branch was fetched and
matched the local branch before changes; the working tree was clean.

## Corrections and boundaries

- `812f19ec` — category bar/list selection filters Analytics, preserves period
  and type, maps a null category identity to `uncategorized`, and uses the
  existing URL owner and filter controls. Report filter changes push history
  entries so back/forward restores them. Historical categories no longer open
  the ACTIVE queue. Buttons provide keyboard/touch access and selected state.
- `84859c83` — five aging COUNT round trips become one parameterized grouped
  conditional aggregate. Existing domain ranges, filters, captured instant and
  RepeatableRead snapshot are retained. No index/schema/timeout/isolation change.
  See [profile methodology, all before/after metrics and plans](it-analytics-performance/README.md).
- The final verification commit expands browser coverage, fixes the new test
  fixture's BigInt construction for the existing TypeScript target, and updates
  architecture and verification records.

Analytics-only access still requires `it.analytics.read / ALL` on the server and
returns aggregate data only. Current priority, urgent, unassigned and untriaged
queue actions still require the independent Ticket-read capability and the
queue API's own authorization. No Ticket listing, Ticket API changes, requester
data, workflow/priority changes, SLA, exports, roles or dependencies were added.

## Executed verification

All final commands below exited **0**. No interrupted command is counted as a
passing run.

| Command | Actual result |
|---|---|
| `npm run typecheck` | Passed. A preceding run exited 2 because new test fixtures used `3n` under the existing pre-ES2020 target. Changed only those literals to `BigInt(3)`; focused persistence tests and the final typecheck passed. |
| `npm run lint:strict` | Passed, zero ESLint warnings. |
| `npm run architecture:check` | Passed; 1,461 repository source files checked. |
| `npm run test -- --maxWorkers=2` | **449 files passed; 4,854 tests passed; 1 existing test skipped (4,855 total)**. Duration 540.37 seconds. No test-file filter or shard; all four configured projects ran. |
| `npm run build` | Passed, Next.js 16.4.5 / Turbopack. Compilation 22.5 s; TypeScript 30.4 s; static generation **108/108**, using seven workers. No route-generation failures. Seven tracing warnings described below. |
| `npm run test:it-analytics-dashboard:browser` | **56 cases passed**: four widths × seven variants × two themes. |
| `node scripts/profile-it-analytics.mjs baseline` | Passed, both 10k/50k datasets, eight inputs and 20 samples per input. |
| `node scripts/profile-it-analytics.mjs final` | Passed; all 16 complete report hashes equal baseline, with aging/priority/trend invariants checked on every sample. |

Focused commands also executed successfully:

```powershell
npm run test -- modules/it/presentation/dashboard/ITAnalyticsDashboard.test.tsx modules/it/presentation/dashboard/ITWorkspace.test.tsx modules/it/presentation/dashboard/analytics-url-state.test.ts --maxWorkers=1
# 3 files / 27 tests

npm run test -- modules/it/infrastructure/persistence/ticket-analytics-repository.test.ts modules/it/domain/analytics-backlog-aging.test.ts modules/it/application/analytics.test.ts --maxWorkers=1
# 3 files / 53 tests

npm run test -- modules/it/infrastructure/persistence/ticket-analytics-repository.test.ts --maxWorkers=1
# 1 file / 2 tests after the BigInt fixture correction
```

The focused real-MySQL run used the existing integration configuration and
dedicated `TEST_DATABASE_URL`, not the production database:

```powershell
node -e 'process.loadEnvFile("integration.env");process.env.DATABASE_URL=process.env.TEST_DATABASE_URL;const r=require("child_process").spawnSync(process.execPath,["node_modules/vitest/vitest.mjs","run","--config","vitest.integration.config.ts","modules/it/__tests__/integration/ticket-analytics.integration.test.ts","modules/it/__tests__/integration/ticket-workflow.integration.test.ts"],{stdio:"inherit",env:process.env});process.exit(r.status??1)'
```

Result: **2 files / 28 tests passed**, exit 0, 24.81 seconds. This includes new
aging boundaries immediately before/exactly at 2/4/8/15 days, future dates,
active/terminal statuses, type/category/uncategorized combinations, existing
historical/current scope assertions, resolution deduplication, canonical
identity/reclassification, averages, Bangkok boundaries and authorization.

The initial category regression ran before its fix and failed twice as expected:
the analytics-only filter button was absent and historical category queue links
were still present. The corrected tests pass in the focused and full runs.
The expanded browser harness initially had a syntax error; it was corrected
before the successful complete 56-case run. No assertions were removed.

## Memory and isolation

Host memory: 7.86 GiB total; 2.22 GiB available immediately before the full suite.
The earlier reviewed implementation had an interrupted memory-sensitive run.
The installed Vitest 4.1.12 supports `--maxWorkers`; the existing configuration
would select three workers on this eight-logical-CPU host. This run used two
workers from the start, retaining file isolation, all assertions and the
existing project/exclusion model. No heap increase, test sharding, disabled
validation or newly skipped tests were used. The complete suite ran once.

The one skip is the existing Windows guard in
`modules/it/infrastructure/attachments/cleanup-orphans.test.ts`: the directory
symlink test uses `it.skipIf(process.platform === "win32")`. It was not changed.
The production build ran after the full suite exited, with 3.00 GiB available.

## Browser scope and evidence

The harness bundles the real workspace/dashboard and **real Recharts**, project
CSS and deterministic aggregate fixtures. It uses existing external
`puppeteer-core` 24.10.0 through `PUPPETEER_MODULE`, and installed Chrome through
`CHART_BROWSER_PATH=C:/Program Files/Google/Chrome/Application/chrome.exe`.
No repository dependency was added. `IT_ANALYTICS_SCREENSHOT_DIR` pointed to
`$env:TEMP/it-analytics-final-screenshots`; desktop/mobile captures in both themes
were inspected.

Coverage: 320/390/768/1280 px; light/dark; populated, empty, loading and error
states (including retry); actual SVG bar clicks; Enter/Space ranked-button
selection; touch taps; canonical URL updates; period/type preservation;
Uncategorized; category changes/removal; browser back/forward; analytics-only
and operator-enabled views; ACTIVE backlog destinations; touch-sized controls;
no horizontal page overflow and no uncaught browser runtime errors. Every fetch
during category interaction is asserted to target only `/api/it/analytics`.

The API responses are fixture aggregates. Next navigation/link adapters are
replaced by a browser-history adapter/plain anchors, while the real workspace
owns the report URL state. This is not an authenticated deployed Next.js E2E,
physical-device, Safari/WebKit or screen-reader speech test. Server permission
and metric correctness are covered separately by real-MySQL and API tests.

## Warnings and merge recommendation

Build warnings: seven instances of dynamic filesystem access causing broad
Turbopack tracing, all in the unchanged
`modules/it/infrastructure/attachments/storage.ts` at lines 81, 132, 150, 173,
189, 210 and 236. That file has no diff from `origin/main`. This is a deployment
size/source-packaging concern to assess separately; filesystem containment
checks were preserved. The build itself passed. Vitest also emits the existing
ESM-in-CommonJS configuration warning about a future Vite native-loader default.

The benchmark establishes fewer queries and unchanged metrics on a local
synthetic serial workload. It does not establish HTTP latency, concurrent
production capacity or uniformly improved tail latency: 50k/90D p95 increased
429.32 → 478.52 ms. Historical event scanning remains a growth risk.

**Local verification gates passed. Keep the merge gate open for independent CI
evidence for the final pushed HEAD.** The repository has no `.github` workflow
configuration and the reviewed starting HEAD had no reported GitHub CI statuses.
No independent CI pass is claimed. Assess the documented performance and tracing
limitations before production release. The task authorizes pushing the feature
branch only; no merge into `main` was performed.
