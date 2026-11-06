# Stock analytics implementation verification

Date: 2026-11-06. Branch: `feat/stock-analytics`. Base: `7e78a240`.
The initial checkout matched `origin/main` after fetch (0 ahead / 0 behind).
No merge, push, dependency update, schema migration or production grant change.

## Phase commits

| Phase | Commit | Result |
| --- | --- | --- |
| 1 | `306144f8` | Contracts, validated Bangkok periods, database aggregation, unit-safe rankings and snapshot quantities |
| 2 | `0bf8f35e` | Secured analytics route, independent central read capability and presentation projection |
| 3 | `7235d6e6` | Overview, KPIs, Recharts, filters, variant drill-down and existing inventory navigation |
| 4 | `27348038` | Separate raw exports; existing workbook sheets preserved; expanded balance-row limits |
| 5 | This verification commit | Reconciliation, ranking/category regressions, UX fixes, browser checks and final verification |

API contracts, exact metrics, scope behavior, row ceilings and operational limits
are documented in [Stock analytics](../features/stock-analytics.md).

## Executed checks

| Check | Actual result |
| --- | --- |
| `npm run lint:strict` | Passed; subsequent small type/test-only edits also passed focused ESLint |
| `npm run typecheck` | Passed; final production build also completed TypeScript validation |
| `npm run architecture:check` | Passed; final run checked 1,452 source files including the live browser runner |
| Focused analytics domain tests | 7 passed, including year bounds and leap-February boundaries |
| Focused API / Stock authorization / projection tests | Passed, including 401/403, scope rejection and read/export independence |
| Focused original and raw workbook/export tests | Passed, including row limits, literal cells, native Bangkok dates and preserved legacy sheets |
| Focused components / navigation | 47 passed across four files after UI and raw-download changes |
| MySQL Stock integration | 39 passed across analytics and existing concurrency suites; real database queries, no production mocks |
| `node scripts/check-stock-analytics.mjs` | 8 viewport/theme cases passed; real components/CSS with explicitly synthetic transport data; keyboard tooltip, focused drill-down, inventory action, explicit download |
| `npm run test` | 443 files passed, 2 failed; 4,760 tests passed, 2 failed, 1 skipped (445 files / 4,763 tests total) |
| Focused correction confirmation | All 92 tests passed across administration, production readiness and analytics domain files |
| `npm run build` | Passed compile, TypeScript and static generation; 7 filesystem-tracing warnings, including existing IT attachment storage |
| Live production browser against dedicated MySQL | Passed real login, Dashboard/API/database reads, raw XLSX reconciliation, mobile overflow, anonymous 401, independent revoked-read/export 403 and preserved export-only access |
| `git diff --check` / UTF-8 review | Passed; no Thai replacement characters found in changed Stock/report files |

The two full-suite failures were stale assertions expecting 46 registered/grantable
capabilities after adding the 47th capability. Both expectations were corrected
and the affected files passed in isolation. The full suite was not repeated for
these test-only corrections; the earlier full-suite result is not presented as a
passing run. No production rules, test strictness, security policy or global
resolver semantics were weakened. The broad run reported no other failures.

## Design verification

Desktop/mobile fixture captures and live app captures were inspected. The scoped
Impeccable finish review requested focus/scroll feedback for drill-down, unique
category donut colors (four plus Other), and Thai business-language KPI copy.
All three fixes were re-captured and scored resolved (`ship` at the scope of
those fixes). The documenter confirmed reuse of existing NHF design tokens.
Existing DESIGN.md/sidecar drift was left unchanged.

## Limits and deferred P1 work

- New analytics read access requires an explicit central grant; no automatic
  role/export-to-read migration. Existing export access remains available.
- Names, attributes and units use current persisted catalog relationships because
  the database does not store historical catalog snapshots.
- Alerts are bounded at 20 and variant detail at 50 per page; totals remain visible.
- Production-sized query-plan profiling and actual production grant/deployment
  canaries are deferred operational P1 work. No load-test or deployment claim.
- One test was skipped by the existing full-suite configuration. The Stock MySQL
  suite and live browser checks completed without skips.
- Build warnings remain; unrelated filesystem tracing code was not changed.

## Changed files

- `__tests__/api/line-home-route.test.ts`
- `__tests__/api/stock-analytics-route.test.ts`
- `__tests__/api/stock-reports-export-route.test.ts`
- `__tests__/auth/current-user-projection.test.ts`
- `__tests__/auth/liff-capabilities.test.ts`
- `__tests__/components/LiffHome.test.tsx`
- `__tests__/constants/dashboard-menu.test.ts`
- `__tests__/context/DashboardProvider.test.tsx`
- `__tests__/dashboard-stock-page.test.tsx`
- `app/api/stock/reports/analytics/route.ts`
- `app/api/stock/reports/export/route.ts`
- `constants/dashboard.ts`
- `docs/features/stock-analytics.md`
- `docs/verification/stock-analytics.md`
- `modules/authorization/application/administration-catalog.ts`
- `modules/authorization/application/administration.test.ts`
- `modules/authorization/application/production-readiness.test.ts`
- `modules/authorization/presentation/dashboard/permission-presentation.ts`
- `modules/authorization/registry.ts`
- `modules/stock/__tests__/integration/stock-analytics.browser.mjs`
- `modules/stock/__tests__/integration/stock-analytics.integration.test.ts`
- `modules/stock/__tests__/liff-app.test.tsx`
- `modules/stock/application/authorization.test.ts`
- `modules/stock/application/authorization.ts`
- `modules/stock/application/effective-access.ts`
- `modules/stock/application/presentation-capabilities.test.ts`
- `modules/stock/application/queries/analytics.ts`
- `modules/stock/application/types.ts`
- `modules/stock/domain/analytics.test.ts`
- `modules/stock/domain/analytics.ts`
- `modules/stock/index.ts`
- `modules/stock/infrastructure/reports/analytics-query.ts`
- `modules/stock/infrastructure/reports/balance-export.ts`
- `modules/stock/infrastructure/reports/raw-export.test.ts`
- `modules/stock/infrastructure/reports/raw-export.ts`
- `modules/stock/presentation/dashboard/StockSection.test.tsx`
- `modules/stock/presentation/dashboard/StockSection.tsx`
- `modules/stock/presentation/dashboard/components/StockAdminReports.test.tsx`
- `modules/stock/presentation/dashboard/components/StockAdminReports.tsx`
- `modules/stock/presentation/dashboard/components/StockAdminRequests.test.tsx`
- `modules/stock/presentation/dashboard/components/StockAnalyticsCharts.tsx`
- `modules/stock/presentation/dashboard/components/StockAnalyticsDetails.tsx`
- `modules/stock/presentation/dashboard/components/StockAnalyticsOverview.test.tsx`
- `modules/stock/presentation/dashboard/components/StockAnalyticsOverview.tsx`
- `modules/stock/presentation/dashboard/components/StockLegacyReports.tsx`
- `modules/stock/presentation/dashboard/components/StockRawDataExport.tsx`
- `modules/stock/presentation/dashboard/components/useStockAnalytics.ts`
- `modules/stock/presentation/dashboard/context/StockProvider.test.tsx`
- `modules/stock/presentation/dashboard/context/StockProvider.tsx`
- `modules/stock/presentation/dashboard/context/provider.shared.test.ts`
- `modules/stock/presentation/dashboard/context/provider.shared.ts`
- `modules/stock/schemas/analytics.ts`
- `modules/stock/schemas/stock.ts`
- `scripts/check-stock-analytics.mjs`
