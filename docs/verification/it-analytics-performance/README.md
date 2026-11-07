# IT analytics query profile — 2026-11-07

## Reproduction and method

```powershell
node scripts/profile-it-analytics.mjs baseline
# Apply the query change, keeping the same integration.env and machine.
node scripts/profile-it-analytics.mjs final
```

Both commands exited 0. Baseline uses the repository at `812f19ec` with the original five aging counts. Final uses the single conditional aggregation. The harness creates synthetic fixtures only in `employee_nhf_analytics_benchmark_test` on the local MySQL server from `integration.env`; apply repository migrations to that dedicated database first. It refuses other hosts and refuses to mix other Tickets with its fixtures. Bulk Tickets/events are removed in `finally`; synthetic reference identities remain stable for output comparison. Never point this at production.

MySQL 8.0.46; Prisma 6.19.3; Node 24.22.1; Intel i5-8300H (8 logical CPUs); 7.86 GiB RAM. The same MySQL instance, hardware, fixture algorithm, captured instant (2026-11-07T03:00:00Z), eight inputs and sample count are used before/after. Fixtures span 730 days, 12 category identities plus uncategorized, three types, four priorities, 1% current backlog, inactive reference data, unassigned/untriaged work, future timestamps, first-response samples and duplicate resolution events. Dataset sizes are proposed benchmarks, not asserted production volumes.

Each scenario has one excluded warm-up and 20 serial samples. p50/p95 use nearest rank; no concurrent load test. Timings cover the real authorized application query plus aggregate JSON serialization. **These are application request-path timings, not HTTP latency**: session decoding, HTTP transport, Next rendering and browser network time are excluded. Transaction timing wraps `$transaction`, including connection acquisition, all workforce/authorization/assignee reads and report composition. Query count includes transaction control statements. Every final DTO SHA-256 matches its baseline for all 16 dataset/input combinations; every sample also checks aging/priority sums and created/resolved daily totals. Individual Prisma query timings (millisecond resolution), queries, JSON plans, actual iterator rows/timing (`EXPLAIN ANALYZE`), and per-sample latency/RSS are in the JSON artifacts.

The MySQL driver explicitly serializes Date parameters as UTC to match Prisma. An initial EXPLAIN probe used the host timezone; those results were discarded and the baseline was rerun with UTC before this comparison. Plans execute outside measured requests. Final raw aging SQL is represented by the equivalent conditional-aggregation experiment plan in `experiments[].singlePlan`; the original SELECT detector did not capture leading whitespace in that raw query. The harness now accepts leading whitespace.

## Before / after

Values are milliseconds, baseline → final. Each row includes request and transaction p50/p95; query counts are statements per request.

| Tickets | Input | Request p50 | Request p95 | Transaction p50 | Transaction p95 | Queries |
|---:|---|---:|---:|---:|---:|---:|
| 10,000 | all-7D | 65.02 → 58.73 | 72.12 → 61.74 | 64.90 → 58.52 | 71.97 → 61.56 | 31 → 27 |
| 10,000 | all-30D | 78.11 → 71.99 | 85.29 → 77.88 | 77.97 → 71.82 | 85.12 → 77.58 | 31 → 27 |
| 10,000 | all-90D | 110.62 → 105.05 | 119.11 → 124.01 | 110.44 → 104.84 | 118.87 → 123.80 | 31 → 27 |
| 10,000 | type-30D | 65.41 → 60.34 | 71.86 → 64.43 | 65.25 → 60.20 | 71.70 → 64.21 | 31 → 27 |
| 10,000 | category-30D | 52.00 → 46.40 | 56.83 → 50.23 | 51.78 → 46.05 | 56.63 → 49.94 | 31 → 27 |
| 10,000 | combined-30D | 50.14 → 44.51 | 59.05 → 48.10 | 49.95 → 44.36 | 58.89 → 47.95 | 31 → 27 |
| 10,000 | empty-30D | 42.91 → 37.55 | 48.55 → 44.90 | 42.75 → 37.39 | 48.39 → 44.72 | 28 → 24 |
| 10,000 | uncategorized-30D | 71.89 → 61.70 | 85.89 → 71.26 | 71.71 → 61.54 | 85.70 → 71.02 | 31 → 27 |

10,000 fixtures: 100 active Tickets, 7,543 resolution events. Process peak RSS (including fixture creation and earlier scenarios): 262.9 → 270.1 MiB. RSS is a process high-water mark, not isolated request allocation; MySQL peak memory was not measured.

| 50,000 | all-7D | 140.79 → 138.29 | 154.41 → 147.87 | 140.68 → 138.18 | 154.24 → 147.75 | 31 → 27 |
| 50,000 | all-30D | 205.04 → 198.89 | 218.48 → 215.85 | 204.84 → 198.72 | 218.27 → 215.67 | 31 → 27 |
| 50,000 | all-90D | 413.09 → 407.04 | 429.32 → 478.52 | 412.91 → 406.86 | 429.10 → 478.13 | 31 → 27 |
| 50,000 | type-30D | 154.82 → 147.11 | 170.97 → 158.09 | 154.61 → 146.96 | 170.67 → 157.90 | 31 → 27 |
| 50,000 | category-30D | 89.21 → 84.16 | 106.81 → 95.74 | 89.02 → 84.01 | 106.66 → 95.58 | 31 → 27 |
| 50,000 | combined-30D | 123.83 → 86.89 | 155.08 → 93.58 | 123.14 → 86.72 | 154.83 → 93.38 | 31 → 27 |
| 50,000 | empty-30D | 103.95 → 73.00 | 151.40 → 76.50 | 103.74 → 72.85 | 151.10 → 76.34 | 28 → 24 |
| 50,000 | uncategorized-30D | 90.13 → 84.75 | 101.28 → 93.67 | 90.00 → 84.59 | 101.09 → 93.53 | 31 → 27 |

50,000 fixtures: 500 active Tickets, 37,714 resolution events. Process peak RSS (including fixture creation and earlier scenarios): 378.9 → 431.6 MiB. RSS is a process high-water mark, not isolated request allocation; MySQL peak memory was not measured.

## Query decisions and plans

- **Aging:** five indexed ranges versus one `CASE`/`COUNT` grouped scan were measured in alternating order, 20 samples each. At 10k, unfiltered median 5.06 → 1.32 ms; combined filter 5.00 → 1.19 ms. At 50k, 5.41 → 1.44 ms and 6.18 → 1.95 ms. The conditional query uses the existing `(status, createdAt, id)` covering range, reading 100 / 500 backlog rows, rather than all 10k / 50k Tickets. Combined filtering reads 500 backlog index rows and retains 154; no full-table aging scan. Production change removes four round trips and maps missing groups to zero. Domain-provided inclusive/exclusive boundaries retain future-date clamping and the captured instant. All values are parameterized; no user-built SQL or new index.

- **Category:** at 10k/50k, unfiltered 30D grouping chooses `it_tickets_createdAt_id_idx`, reading only the period cohort (see actual plans; approximately 400/2,000 rows), using a temporary aggregation with 13 groups. This differs from the earlier tiny-fixture full covering-index scan. Combined filters use the existing category/createdAt range and type residual. There is no measured need for an extra period-first covering index or a forced-index rewrite. Avoiding a new index avoids write amplification/storage/migration cost for every Ticket creation and category update.

- **Timestamp movement:** created timestamps and first-response rows remain bounded by the period; 50k/30D has about 2,000 created rows and about 1,500 response rows. Resolution events still deduplicate earliest qualifying event per Ticket in SQL, then project Ticket creation/current priority. The unfiltered event aggregation scans all 37,714 fixture events via `(ticketId, occurredAt, id)` before retaining roughly 1,500 events. This is a remaining growth risk. No timestamp-aggregation rewrite or event index is claimed: reducing the already period-bounded projections would require changing the persistence/application contract, while event scanning and historical all-status groupings remain the larger scaling limitation. Bangkok daily bucketing and duration definitions stay in the existing application code.

- **Transaction:** application and global Prisma client do not override `timeout`/`maxWait`; Prisma 6 defaults are 5,000/2,000 ms ([official v6 documentation](https://www.prisma.io/docs/orm/prisma-client/queries/transactions#transaction-options)). The test URL has no `connection_limit`, `pool_timeout`, or `connect_timeout` overrides. No timeout, pool setting, isolation, or global configuration changed. All reads still share RepeatableRead. The maximum final p95 is below 0.5 s on this serial local workload; that does not establish headroom under concurrent connection pressure.

## Correctness and limitations

`npm run test -- modules/it/infrastructure/persistence/ticket-analytics-repository.test.ts modules/it/domain/analytics-backlog-aging.test.ts modules/it/application/analytics.test.ts --maxWorkers=1` passed 3 files / 53 tests. Focused MySQL analytics + workflow passed 2 files / 28 tests, including exact aging boundaries and their immediately preceding millisecond, all active statuses, excluded terminal statuses, type/category/uncategorized combinations, future timestamps, distinct resolutions, current canonical identities, reclassification and authorization. Full DTO equality in the profile covers all existing KPI definitions, current-priority grouping and Bangkok trends.

The p50 improvement is modest for unfiltered 90D; p95 worsened from 119.11 → 124.01 ms (10k) and 429.32 → 478.52 ms (50k). Twenty samples on a shared Windows host cannot attribute tail differences confidently. Type/category assignment is correlated to provide a deterministic empty combination and does not represent arbitrary production selectivity. Combined/empty baseline tails also show host noise. The claim supported directly is four fewer round trips, a faster isolated aging operation and identical metrics—not uniformly improved tail latency.

This is a single-host synthetic serial benchmark, without production distribution, sustained concurrent load, cold-cache trials, HTTP/session overhead, database memory profiling or production-scale SLA. Historical data movement and event scans remain proportional to volume. Do not claim production-scale readiness from these results. Retest representative workloads and concurrency before making capacity promises.
