# Stock analytics correction verification

Date: 2026-11-06. Branch: `feat/stock-analytics`. Correction baseline: `3dcfd238`.
Product: **Analytics Dashboard + original legacy Excel reports**.

## Corrections

- `65013243`: removes added export workbooks, forms, filters, category metadata,
  contracts and tests. The Excel view uses the original `StockLegacyReports`
  and `useStockAdminReports`, retaining annual and balance sheets, filenames,
  authorization and expanded balance-row safety checks.
- `fa30bd03`: reads material IDs from the declared Recharts rectangle payload;
  adds real SVG click/keyboard coverage and one atomic Inventory URL operation.
  Existing category/search/page parameters cannot override the destination;
  pending debounced drafts are cancelled. URL-derived state supports back/forward.
- Verification commit: legacy workbook reconciliation, expanded-row/race limits,
  production-browser regressions and this evidence record.

Read and export capabilities remain independent. Read-authorized users default
to Overview. Export-only users see original Excel reports. Neither capability
is inferred from the other. Reports remain hidden without either capability.
There are no new database schemas, migrations, dependencies or grant defaults.

## Investigation evidence

The sequential low-stock navigation reproduced three failing provider tests:
one click emitted both replace and push using stale query parameters. The
atomic operation passes clean, category-filtered and previously paginated cases,
plus a pending debounce case and external back/forward URL notifications.

Recharts **3.8.0** was checked through Context7 and installed `Bar.d.ts` / `Bar.js`.
`BarRectangleItem.payload` carries the original datum. The installed runtime also
spreads datum properties onto the rectangle, so the real SVG baseline already
passed with direct `row.id`; this task does not claim a reproduced bar-click
failure. The handler now uses the declared payload contract with an unknown
boundary guard. Browser coverage clicks the second rendered bar, verifies ID 2,
keeps project filters, checks the matching material heading/focus and activates
the first textual alternative with Enter. The production runner repeats this
with the actual material/variant IDs returned by MySQL.

## Executed verification

| Check | Actual result |
| --- | --- |
| `npm run typecheck` | Passed for the final TypeScript changes |
| `npm run lint:strict` | Passed; subsequent added regression tests passed focused ESLint |
| `npm run architecture:check` | Passed, 1,450 repository source files |
| Focused Excel API / legacy UI / view permissions / analytics UI tests | 34 passed across 5 files |
| Focused provider / Stock section / existing request UI tests | 26 passed across 3 files; final provider suite 20 passed after adding debounce and denied-navigation cases |
| MySQL analytics + existing Stock concurrency suites | 39 passed across 2 files |
| Final MySQL workbook-reader check | 1 selected test passed; 3 deliberately unselected by `-t` |
| Isolated browser | 8 viewport/theme cases passed, including real SVG bar click/ID, filter retention, keyboard detail/focus and both legacy download actions |
| `npm run test` | **445 files passed; 4,770 tests passed, 1 skipped; no failures.** Duration 539.86 s |

The full repository suite was rerun in this correction task, after the complete
runtime diff was stable. The previous implementation's two stale capability-count
assertions now pass in that complete run. One existing skipped test remains;
no test rule was weakened and no production behavior was changed to satisfy it.

| Additional check | Actual result |
| --- | --- |
| `npm run build` | Passed compile (18.5 s), TypeScript (40 s), and 108 static pages; 7 filesystem-tracing warnings remain, including untouched IT attachment storage |
| Live production browser + dedicated MySQL | Passed real login, SVG/keyboard drill-down, preserved filters, atomic SKU navigation, actual back/forward, original annual and balance file downloads, worksheet/filename/quantity reconciliation, retired-mode 400s, independent read/export views and 403s; no page runtime errors |
| Final browser-runner ESLint | Passed after test-only harness corrections |
| `git diff --check` / UTF-8 inspection | Passed; no replacement characters or corrupted Thai in the correction diff |

The initial live attempt exposed runner problems: the local `.env` supplied a
non-production NODE_ENV and an unsuitable localhost public URL, and a button
selector matched the Inventory tab instead of the alert action. The runner now
pins production mode and an isolated `stock-browser.localhost` origin, selects
the alert action explicitly, and verifies actual Chrome-saved downloads using
CDP download-completion events. DevTools response-body retrieval returned empty
bytes for a successful UI download; reading the saved files resolved the harness
limitation. These changes are confined to the test runner. The final live run
passed in full; no application authentication or download protection was relaxed.

No runtime or unit-test files changed after the passing complete suite; later
changes were limited to the optional browser runner and documentation. Focused
ESLint and the complete live browser check passed for those final changes.

## Remaining limits

- One existing full-suite test is skipped; no deterministic test failure remains.
- The 7 build warnings are unresolved outside this Stock correction's scope.
- Dedicated test data and captures stay outside production/Git. This verifies a
  local production build, not a deployed environment or physical device.
- Existing analytics limits remain: 20 alerts, 50 variants per detail page,
  present-day catalog labels/units, and explicit central report-read grants.
  Production-sized query profiling and deployed grant/device canaries remain P1
  operational work; no schema, deployment or merge is performed.

## Browser tooling and scope

The isolated runner uses production React components, actual Recharts and app
CSS with explicitly synthetic transport. It exercises 320/390/768/1280px, light
and dark themes, page overflow, two donuts, tooltip, real bar click, keyboard
alternative, detail focus, inventory action and both original Excel actions.
Desktop/mobile/Excel captures were inspected; captures remain outside Git.

The live runner requires a dedicated `_test` / `_integration` MySQL database.
It starts/stops the built production server and uses actual login cookies,
server authorization, SQL analytics and original Excel responses. It verifies
real SVG click/keyboard drill-down, project filters, SKU navigation from a URL
with incompatible category and old pagination, real browser back/forward,
both original download buttons, exact worksheet names and reconciliation of
issued quantities plus physical/reserved/available/minimum balances. It also
checks retired export modes/metadata return 400, anonymous analytics returns
401, read-only/export-only UI and independent revoked capabilities return 403.
Test data remains only in the dedicated DB; no production grant is changed.

Optional browser commands (after build for the live runner):

```powershell
$env:STOCK_BROWSER_DRIVER = ([uri](Join-Path $env:TEMP 'nhf-browser-tools/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).AbsoluteUri
$env:CHART_BROWSER_PATH = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
node scripts/check-stock-analytics.mjs
node modules/stock/__tests__/integration/stock-analytics.browser.mjs
```

No Puppeteer app dependency was added; the driver resides in a temporary tools
folder outside the repository. See [feature contract](../features/stock-analytics.md)
for metric definitions and existing limits.

## Files changed in this correction task

- `__tests__/api/stock-reports-export-route.test.ts` (modified)
- `app/api/stock/reports/export/route.ts` (modified)
- `docs/features/stock-analytics.md` (modified)
- `docs/verification/stock-analytics.md` (modified)
- `modules/stock/__tests__/integration/stock-analytics.browser.mjs` (modified)
- `modules/stock/__tests__/integration/stock-analytics.integration.test.ts` (modified)
- `modules/stock/__tests__/report-export.test.ts` (modified)
- `modules/stock/index.ts` (modified)
- `modules/stock/infrastructure/reports/raw-export.test.ts` (deleted)
- `modules/stock/infrastructure/reports/raw-export.ts` (deleted)
- `modules/stock/presentation/dashboard/StockSection.tsx` (modified)
- `modules/stock/presentation/dashboard/components/StockAdminReports.test.tsx` (modified)
- `modules/stock/presentation/dashboard/components/StockAdminReports.tsx` (modified)
- `modules/stock/presentation/dashboard/components/StockAdminRequests.test.tsx` (modified)
- `modules/stock/presentation/dashboard/components/StockAnalyticsCharts.tsx` (modified)
- `modules/stock/presentation/dashboard/components/StockRawDataExport.tsx` (deleted)
- `modules/stock/presentation/dashboard/components/StockReportViews.test.tsx` (added)
- `modules/stock/presentation/dashboard/context/StockProvider.test.tsx` (modified)
- `modules/stock/presentation/dashboard/context/StockProvider.tsx` (modified)
- `modules/stock/presentation/dashboard/context/types.ts` (modified)
- `modules/stock/schemas/stock.ts` (modified)
- `scripts/check-stock-analytics.mjs` (modified)
