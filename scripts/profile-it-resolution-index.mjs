import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { assertDisposableMysql, validateDisposableTarget } from "./mysql-integration-safety.mjs";
import os from "node:os";
import { performance } from "node:perf_hooks";
import mysql from "mysql2/promise";
import { PrismaClient } from "@prisma/client";
import { tsImport } from "tsx/esm/api";

const databaseUrl = validateDisposableTarget(process.env);
await assertDisposableMysql();
const samples = 20;
const db = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
globalThis.prisma = db;
const connection = await mysql.createConnection({ uri: databaseUrl.toString(), timezone: "Z" });
const { getITAnalyticsDashboard } = await tsImport("../modules/it/application/analytics.ts", import.meta.url);
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
    for (const size of [50000]) {
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
                const wanted = scenarios.filter(([name]) => ["all-30D", "all-90D", "combined-30D"].includes(name));
        const max = await db.iTTicketEvent.aggregate({ _max: { id: true } });
        const insertRows = tickets.slice(0, 500).map((ticket) => ({
            ticketId: ticket.id, actorUserId: user.id, kind: "STATUS_CHANGED", toStatus: "RESOLVED",
            occurredAt: new Date(NOW.getTime() - DAY),
        }));
        const environment = { mysql: (await connection.query("SELECT VERSION() AS v"))[0][0].v,
            prisma: "6.19.3", node: process.version, cpu: os.cpus()[0].model, cores: os.availableParallelism(),
            memory: os.totalmem(), events: await db.iTTicketEvent.count(), tickets: size, samples, writeBatchSize: insertRows.length };
        console.log("IT_INDEX_PROFILE " + JSON.stringify({ environment }));
        const reference = new Map();
        for (const label of ["before", "index"]) {
            if (label === "index") {
                await connection.query("CREATE INDEX profile_resolution_kind_status_time_ticket ON it_ticket_events (kind, toStatus, occurredAt, ticketId)");
                await connection.query("ANALYZE TABLE it_ticket_events");
            }
            await connection.query("SET SESSION information_schema_stats_expiry = 0");
            const [[storage]] = await connection.query("SELECT INDEX_LENGTH AS indexBytes FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='it_ticket_events'");
            const inserts = [];
            for (let i = -2; i < samples; i++) {
                const start = performance.now();
                const result = await db.iTTicketEvent.createMany({ data: insertRows });
                if (i >= 0) inserts.push(performance.now() - start);
                assert.equal(result.count, insertRows.length);
                await db.iTTicketEvent.deleteMany({ where: { id: { gt: max._max.id } } });
                queries = [];
            }
            const stats = (values) => ({ p50: percentile(values, .5), p95: percentile(values, .95) });
            for (const [name, input] of wanted) {
                const runs = [];
                let captured;
                let payloadDigest;
                for (let i = -2; i < samples; i++) {
                    queries = [];
                    const start = performance.now();
                    const response = await getITAnalyticsDashboard(context, input, NOW);
                    const serialized = JSON.stringify(response);
                    const duration = performance.now() - start;
                    payloadDigest ??= digest(response);
                    assert.equal(createHash("sha256").update(serialized).digest("hex"), payloadDigest);
                    if (i >= 0) runs.push({ duration, transactionMs, prismaEvents: queries.length, rss: process.memoryUsage().rss });
                    captured = queries.find((q) => q.sql.includes("it_ticket_events") && q.sql.includes("GROUP BY"));
                }
                if (label === "before") reference.set(name, payloadDigest);
                else assert.equal(payloadDigest, reference.get(name));
                assert.ok(captured);
                const params = JSON.parse(captured.params).map((v) => typeof v === "string" && /^\d{4}-\d\d-\d\d[T ]/.test(v) ? new Date(v) : v);
                const [explain] = await connection.query("EXPLAIN ANALYZE " + captured.sql, params);
                console.log("IT_INDEX_PROFILE " + JSON.stringify({ label, name, payloadDigest, indexBytes: storage.indexBytes,
                    insertMs: stats(inserts), elapsedMs: stats(runs.map((r) => r.duration)), transactionMs: stats(runs.map((r) => r.transactionMs)),
                    prismaQueryMs: captured.ms, explain: explain[0].EXPLAIN, sql: captured.sql, runs }));
            }
        }
    }
} finally {
    await connection.end();
    await db.$disconnect();
}
