import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import { performance } from "node:perf_hooks";
import mysql from "mysql2/promise";
import { PrismaClient } from "@prisma/client";
import { tsImport } from "tsx/esm/api";

// Only deterministic synthetic data in an explicitly named, dedicated database.
process.loadEnvFile("integration.env");
const databaseUrl = new URL(process.env.TEST_DATABASE_URL);
databaseUrl.pathname = "/employee_nhf_analytics_benchmark_test";
assert.equal(databaseUrl.hostname, "127.0.0.1", "local benchmark only");
assert.equal(databaseUrl.protocol, "mysql:");
process.env.DATABASE_URL = databaseUrl.toString();
const phase = process.argv[2];
assert.ok(["baseline", "final"].includes(phase));
const samples = Number(process.env.IT_ANALYTICS_BENCH_SAMPLES ?? 20);
assert.ok(Number.isInteger(samples) && samples >= 5);
const db = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
globalThis.prisma = db;
const connection = await mysql.createConnection({ uri: databaseUrl.toString(), timezone: "Z" });
const { getITAnalyticsDashboard } = await tsImport("../modules/it/application/analytics.ts", import.meta.url);
const { getITBacklogAgeBucketBounds } = await tsImport("../modules/it/domain/analytics-backlog-aging.ts", import.meta.url);
const { buildITAuthorizationContext } = await tsImport("../modules/it/application/authorization.ts", import.meta.url);
const NOW = new Date("2026-11-07T03:00:00.000Z");
const DAY = 86400000;
let queries = [];
db.$on("query", (event) => queries.push({ sql: event.query, params: event.params, ms: event.duration }));
let transactionMs = 0;
const transaction = db.$transaction.bind(db);
db.$transaction = async (callback, options) => {
    const start = performance.now();
    try { return await transaction(callback, options); }
    finally { transactionMs = performance.now() - start; }
};
const percentile = (values, p) => [...values].sort((a, b) => a - b)[Math.ceil(values.length * p) - 1];
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const outputDir = "docs/verification/it-analytics-performance";
await mkdir(outputDir, { recursive: true });
try {
    const department = await db.department.upsert({ where: { code: "it-analytics-bench" }, update: {}, create: { code: "it-analytics-bench", name: "Benchmark" } });
    const employee = await db.employee.findFirst({ where: { email: "it-analytics-bench@fixture.test" } })
        ?? await db.employee.create({ data: { firstName: "Benchmark", lastName: "Synthetic", email: "it-analytics-bench@fixture.test", position: "Test", departmentId: department.id } });
    const user = await db.user.upsert({ where: { email: "it-analytics-bench@fixture.test" }, update: {}, create: { email: "it-analytics-bench@fixture.test", password: "not-a-login", name: "Synthetic Benchmark", role: "USER", employeeId: employee.id } });
    if (!await db.userCapabilityGrant.findFirst({ where: { userId: user.id, capabilityKey: "it.analytics.read", scope: "ALL" } })) {
        await db.userCapabilityGrant.create({ data: { userId: user.id, capabilityKey: "it.analytics.read", scope: "ALL" } });
    }
    const categories = [];
    for (let index = 0; index < 12; index++) categories.push(await db.iTTicketCategory.upsert({
        where: { key: `BENCH_${index}` }, update: {}, create: { key: `BENCH_${index}`, name: `Synthetic ${index}`, isActive: index !== 11 },
    }));
    const context = buildITAuthorizationContext({ id: user.id, role: user.role }, employee.id);
    for (const size of [10000, 50000]) {
        await db.iTTicketEvent.deleteMany({ where: { ticket: { requesterUserId: user.id } } });
        await db.iTTicket.deleteMany({ where: { requesterUserId: user.id } });
        assert.equal(await db.iTTicket.count(), 0, "benchmark database must not contain other Tickets");
        for (let offset = 0; offset < size; offset += 1000) {
            await db.iTTicket.createMany({ data: Array.from({ length: Math.min(1000, size - offset) }, (_, row) => {
                const i = offset + row;
                // 1% active backlog; historical creation spans 730 days, includes future clock skew.
                const createdAt = new Date(NOW.getTime() - ((i * 37) % 730) * DAY - (i % 24) * 3600000 + (i % 997 === 0 ? 740 * DAY : 0));
                const active = i % 100 === 0;
                return { type: ["INCIDENT", "SERVICE_REQUEST", "SUGGESTION"][i % 3],
                    status: active ? ["OPEN", "IN_PROGRESS", "WAITING_REQUESTER"][i % 3] : ["RESOLVED", "CLOSED", "CANCELLED"][i % 3],
                    priority: ["P0", "P1", "P2", "P3"][Math.floor(i / 3) % 4],
                    title: "Synthetic benchmark", description: "Synthetic fixture only", requesterUserId: user.id,
                    assignedToUserId: i % 7 === 0 ? user.id : null,
                    categoryId: i % 13 === 0 ? null : categories[i % 12].id,
                    triagedAt: i % 5 === 0 ? null : createdAt,
                    createdAt, updatedAt: createdAt,
                    firstRespondedAt: i % 4 === 0 ? null : new Date(createdAt.getTime() + (i % 180 - 2) * 60000),
                    requesterDepartmentNameSnapshot: `Synthetic department ${i % 8}`,
                };
            }) });
        }
        const tickets = await db.iTTicket.findMany({ select: { id: true, createdAt: true }, orderBy: { id: "asc" } });
        for (let offset = 0; offset < size; offset += 1000) {
            const data = tickets.slice(offset, offset + 1000).flatMap((ticket, row) => {
                const i = offset + row;
                if (i % 3 === 2 || i % 100 === 0) return [];
                const occurredAt = new Date(ticket.createdAt.getTime() + (i % 14) * DAY + 1800000);
                const event = { ticketId: ticket.id, actorUserId: user.id, kind: "STATUS_CHANGED", toStatus: "RESOLVED", occurredAt };
                return i % 7 === 0 ? [event, { ...event, occurredAt: new Date(occurredAt.getTime() + DAY) }] : [event];
            });
            if (data.length) await db.iTTicketEvent.createMany({ data });
        }
        await connection.query("ANALYZE TABLE it_tickets, it_ticket_events");
        const scenarios = [
            ["all-7D", { period: "7D" }], ["all-30D", { period: "30D" }], ["all-90D", { period: "90D" }],
            ["type-30D", { period: "30D", type: "INCIDENT" }],
            ["category-30D", { period: "30D", category: String(categories[0].id) }],
            ["combined-30D", { period: "30D", type: "INCIDENT", category: String(categories[0].id) }],
            ["empty-30D", { period: "30D", type: "SERVICE_REQUEST", category: String(categories[0].id) }],
            ["uncategorized-30D", { period: "30D", category: "uncategorized" }],
        ];
        const experiments = [];
        for (const filtered of [false, true]) {
            const baseParams = ["OPEN", "IN_PROGRESS", "WAITING_REQUESTER", ...(filtered ? ["INCIDENT", categories[0].id] : [])];
            const base = "status IN (?, ?, ?)" + (filtered ? " AND type = ? AND categoryId = ?" : "");
            const ranges = getITBacklogAgeBucketBounds(NOW);
            const predicates = ranges.map((range) => ({
                sql: [range.createdAtLte === null ? null : "createdAt <= ?", range.createdAtGt === null ? null : "createdAt > ?"].filter(Boolean).join(" AND "),
                params: [range.createdAtLte, range.createdAtGt].filter((value) => value !== null),
            }));
            const singleSql = "SELECT CASE " + predicates.map((p) => "WHEN " + p.sql + " THEN ?").join(" ") + " END AS bucket, COUNT(*) AS count FROM it_tickets WHERE " + base + " GROUP BY bucket";
            const singleParams = [...predicates.flatMap((p, i) => [...p.params, ranges[i].key]), ...baseParams];
            const timings = { five: [], single: [] };
            for (let sample = 0; sample < samples; sample++) {
                // Alternate ordering to reduce systematic warm-cache bias.
                for (const variant of sample % 2 === 0 ? ["five", "single"] : ["single", "five"]) {
                    const start = performance.now();
                    if (variant === "five") {
                        for (const p of predicates) await connection.query("SELECT COUNT(*) AS count FROM it_tickets WHERE " + base + " AND " + p.sql, [...baseParams, ...p.params]);
                    } else await connection.query(singleSql, singleParams);
                    timings[variant].push(performance.now() - start);
                }
            }
            const [singlePlan] = await connection.query("EXPLAIN ANALYZE " + singleSql, singleParams);
            experiments.push({ name: filtered ? "combined" : "all", fiveP50Ms: percentile(timings.five, .5), singleP50Ms: percentile(timings.single, .5), timings, singlePlan });
        }
        const results = [];
        for (const [name, input] of scenarios) {
            await getITAnalyticsDashboard(context, input, NOW); // warm-up excluded
            const runs = [];
            let last;
            let captured;
            for (let sample = 0; sample < samples; sample++) {
                queries = [];
                const start = performance.now();
                last = await getITAnalyticsDashboard(context, input, NOW);
                JSON.stringify(last); // include aggregate response serialization, excludes HTTP/session transport
                const requestMs = performance.now() - start;
                captured = [...queries];
                assert.equal(last.backlogAging.reduce((sum, row) => sum + row.count, 0), last.summary.currentBacklog);
                assert.equal(last.priorityBacklog.reduce((sum, row) => sum + row.count, 0), last.summary.currentBacklog);
                assert.equal(last.trend.reduce((sum, row) => sum + row.created, 0), last.summary.newTickets);
                assert.equal(last.trend.reduce((sum, row) => sum + row.resolved, 0), last.summary.resolvedTickets);
                runs.push({ requestMs, transactionMs, queryCount: captured.length, rssBytes: process.memoryUsage().rss });
            }
            const plans = [];
            if (name === "all-30D" || name === "combined-30D") {
                for (const query of captured.filter((q) => /^\s*SELECT/i.test(q.sql))) {
                    const params = JSON.parse(query.params).map((v) => typeof v === "string" && /^\d{4}-\d\d-\d\d[T ]/.test(v) ? new Date(v) : v);
                    const [plan] = await connection.query(`EXPLAIN FORMAT=JSON ${query.sql}`, params);
                    const [actual] = await connection.query(`EXPLAIN ANALYZE ${query.sql}`, params);
                    plans.push({ sql: query.sql, plan, actual });
                }
            }
            results.push({ name, input, metrics: {
                requestP50Ms: percentile(runs.map((r) => r.requestMs), .5), requestP95Ms: percentile(runs.map((r) => r.requestMs), .95),
                transactionP50Ms: percentile(runs.map((r) => r.transactionMs), .5), transactionP95Ms: percentile(runs.map((r) => r.transactionMs), .95),
                queryCount: runs[0].queryCount, maxSampledRssBytes: Math.max(...runs.map((r) => r.rssBytes)),
            }, runs, dashboardDigest: digest(last), summary: last.summary, queries: captured, plans });
            process.stdout.write(`${phase} ${size} ${name}: ${JSON.stringify(results.at(-1).metrics)}\n`);
        }
        const report = { phase, size, samples, now: NOW, versions: { mysql: (await connection.query("SELECT VERSION() AS version"))[0][0].version, prisma: "6.19.3", node: process.version }, hardware: { cpu: os.cpus()[0].model, logicalCpus: os.availableParallelism(), memoryBytes: os.totalmem() }, experiments, backlog: await db.iTTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS", "WAITING_REQUESTER"] } } }), events: await db.iTTicketEvent.count(), results, processPeakRssBytes: process.resourceUsage().maxRSS * 1024 };
        if (phase === "final") {
            const baseline = JSON.parse(await readFile(`${outputDir}/baseline-${size}.json`, "utf8"));
            for (const result of results) assert.equal(result.dashboardDigest, baseline.results.find((r) => r.name === result.name).dashboardDigest, `${size} ${result.name}: baseline metrics changed`);
        }
        await writeFile(`${outputDir}/${phase}-${size}.json`, JSON.stringify(report, null, 2) + "\n");
    }
} finally {
    // Retain reference fixture identities for identical before/after outputs; remove bulk data.
    await db.iTTicketEvent.deleteMany({ where: { ticket: { requester: { email: "it-analytics-bench@fixture.test" } } } });
    await db.iTTicket.deleteMany({ where: { requester: { email: "it-analytics-bench@fixture.test" } } });
    await connection.end();
    await db.$disconnect();
}
