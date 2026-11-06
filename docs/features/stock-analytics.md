# Stock Analytics Dashboard and original Excel reports

Stock Reports opens **ภาพรวม** when `stock.report.read / ALL / DASHBOARD`
is effective. This capability is centrally grantable with no domain default;
ADMIN, inventory management and export authority do not imply analytics read.
Configure the new read grant through existing Authorization Administration.
No grants or role mappings are changed automatically. Export-only users retain
the Reports entry and the **รายงาน Excel** view. Read-only users cannot export.

## HTTP contracts

- `GET /api/stock/reports/analytics`: active workforce session, central read
  authorization and explicit effective `ALL` scope before any report query.
  Responses are private/no-store. Errors do not expose database details.
- `GET /api/stock/reports/export`: existing export authorization and annual
  `requests` / current `balances` contracts are the only supported reports.
  Both original panels use `StockLegacyReports` and `useStockAdminReports`.

Analytics filters: `year` (Gregorian Bangkok calendar year, current by default),
`fromMonth=1`, `toMonth=12`, optional `categoryId`, exact `projectCode`,
`metric=frequency|quantity`, and optional `unit`. Quantity ranking requires a
unit. `itemId` and `page` add a material's variant usage detail, 50 rows per page.
Analytics filters do not change Excel reporting. Annual Excel keeps its original
year selection; the inventory balance report is a current snapshot.

## Metric definitions

| Metric | Definition |
| --- | --- |
| Issued requests | Distinct issued request IDs with at least one matching line in the period/category/project |
| Issued lines | Matching `StockRequestItem` rows, not unique materials or physical quantity |
| Material frequency | Distinct issued request IDs grouped by canonical `StockItem.id`; several variants in one request count once |
| Quantity ranking | Sum of persisted line quantity within one exactly matched unit only; all-unit request frequency stays unchanged |
| Category share | Matching issued lines per category divided by all matching issued lines; multi-category requests contribute to multiple categories |
| Pending requests | Current global `PENDING_ISSUE` request count, independent of historical filters |
| Inventory health | Current active variants belonging to active items, counted once per variant |

Historical reads include only `ISSUED` and actual `issuedAt`, never creation
time, pending, cancelled or legacy-rejected records. MySQL physical mappings
remain `APPROVED` and `reviewedAt`. Periods are half-open Bangkok boundaries
`[start, end)`, using the same year-boundary utility as annual Excel reports.
Category labels, names, SKUs, attributes and units come from persisted catalog
relations; the schema has no historical catalog-label/unit snapshot to reconstruct.
Historical usage includes subsequently deactivated materials/variants.

Frequency and quantity ranks sort descending, then by numeric material ID
ascending. Drill-down ties sort by variant ID. Quantity breakdowns use exact
unit strings (binary grouping/comparison in MySQL); incompatible units never
become one total. Top-five availability also stays separated by unit.

Available stock uses the existing canonical `getAvailableQuantity` calculation:
physical minus aggregated pending reservations, clamped to zero. Missing
pending variant snapshots fail with the existing inventory invariant error.
No parent quantity is added to variant quantities. Classifications are exclusive:

- Out: available ≤ 0.
- Low: available > 0 and minimum > 0 and available ≤ minimum.
- Healthy: otherwise. A zero minimum disables the positive low band, not out-of-stock detection.

Analytics runs in one RepeatableRead transaction. Historical rows are aggregated
in MySQL; Top N is bounded at 10. Current inventory is scanned in 500-variant
keyset batches with database-grouped reservations and bounded memory. Only
the first 20 attention variants reach the client, ordered out-first then ID;
the total count is shown. Detail reads are bounded and avoid per-variant queries.
Refresh recomputes the report; no cache infrastructure or schema/index changes
were introduced without production query-plan evidence.

## Dashboard interactions

The Top 10 chart reads the canonical material ID from Recharts 3.8.0's
`BarRectangleItem.payload`; text controls offer the same drill-down by keyboard.
The selected reporting filters are retained and focus moves to the detail heading.
The installed implementation also spreads datum fields onto the rectangle, so
the original direct-ID handler passed the real-bar baseline check; payload access
uses the explicitly declared event contract rather than that implementation detail.

Low-stock actions use one provider operation and one `router.push` through the
existing Stock URL helper. The destination sets the Inventory tab and SKU search,
clears category, resets both item-page keys to 1, and preserves unrelated query
parameters. A pending debounced search draft cannot overwrite this destination.
Back/forward derive tab, search and category from the canonical URL.

## Export compatibility and limits

Annual sheets **สรุปการใช้วัสดุ** / **รายละเอียดที่ใช้คำนวณ** and balance
sheet **ยอดคงเหลือจริง** remain unchanged, including filenames and download behavior.
Balance metadata counts expanded active variants plus existing fallback rows;
actual workbook rows are checked again against the existing 5,000-row ceiling.
Existing download deadlines, MIME validation, UTF-8 filenames and locking remain.
No additional worksheets, export filters or export formats are introduced.

## Verification

Focused MySQL tests exercise the actual mapped SQL, distinct request counting,
several variants, mixed units, canonical identities with identical names,
category percentages, deactivated history, status exclusion, leap-February
boundaries, empty periods, reservation availability and original Excel reconciliation.
Stock concurrency integration tests cover existing issuance/inventory invariants.
API tests cover active sessions, read/export independence, scope rejection,
invalid queries and sanitized failures. Component tests cover filters, drill-down,
refresh, empty/error/loading states and explicit downloads.

`node scripts/check-stock-analytics.mjs` renders the real Reports components and
project CSS using isolated, clearly labeled synthetic transport data. It does
not replace a deployed end-to-end test. It checks 320/390/768/1280px in light/dark,
page overflow/runtime errors, two rendered donuts, real SVG bar clicks with
canonical ID/filter assertions, keyboard tooltip and focused drill-down, inventory
action and explicit legacy Excel downloads. It uses the same
optional browser tooling pattern as the IT chart check. When Puppeteer is not
installed, set `STOCK_BROWSER_DRIVER` to the file URL of an external
`puppeteer-core` entry and `CHART_BROWSER_PATH` to a Chrome/Edge executable.
Optional `STOCK_CAPTURE_DIR` reuses a capture folder. No app dependency is added.

After `npm run build`, the optional live check is
`node modules/stock/__tests__/integration/stock-analytics.browser.mjs` with the
same browser variables and `TEST_DATABASE_URL` (or `integration.env`). It refuses
databases without `_test` / `_integration` suffixes, creates isolated test records,
starts/stops the production server with explicit production mode and an isolated
`stock-browser.localhost` browser origin, uses real login cookies and real APIs, checks
real chart clicks, keyboard drill-down, filtered Inventory navigation and browser
back/forward. It downloads both original Excel reports through the original UI,
checks Chrome-saved files, filenames, worksheets, issuance totals and
physical/reserved/available quantities,
rejects retired modes, then revokes read/export grants to verify separate views
and 403 responses. It never changes production
data or authorization configuration. Test records remain in the dedicated DB.

Deferred operational work: profile query plans against production-sized data
before adding indexes; validate with actual production grant configuration and
deployment infrastructure. No production grants, migration, deployment or merge
is performed by this feature.
