import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import os from "node:os";
import { performance } from "node:perf_hooks";
import { Prisma, PrismaClient } from "@prisma/client";
import mysql from "mysql2/promise";
import { tsImport } from "tsx/esm/api";
import { assertDisposableMysql, validateDisposableTarget } from "./mysql-integration-safety.mjs";
import { NOW, scenariosFor, seedITResolutionFixture } from "./profile-it-resolution-fixture.mjs";

const url = validateDisposableTarget(process.env);
await assertDisposableMysql();
const WARMUPS = 2;
const SAMPLES = 20;
const requestedSize = process.env.NHF_IT_RESOLUTION_SIZE;
assert.ok(requestedSize === undefined || ["10000", "50000", "100000"].includes(requestedSize));
const sizes = requestedSize === undefined ? [10000, 50000, 100000] : [Number(requestedSize)];
const indexes = [
    ["baseline", null],
    ["full", "kind, toStatus, occurredAt, ticketId"],
    ["narrow", "toStatus, occurredAt, ticketId"],
];
const indexName = "profile_it_resolution";
const report = (record) => process.stdout.write(`IT_RESOLUTION_PROFILE ${JSON.stringify(record)}\n`);
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const rounded = (value) => Math.round(value * 1000) / 1000;
function stats(values) {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return { p50: rounded(sorted[Math.ceil(sorted.length * .5) - 1]), p95: rounded(sorted[Math.ceil(sorted.length * .95) - 1]) };
}

const trace = new AsyncLocalStorage();
const readerClient = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
const writer = new PrismaClient();
let sqlCapture;
readerClient.$on("query", (event) => sqlCapture?.push(event));
const reader = readerClient.$extends({
    query: {
        async $allOperations({ model, operation, args, query }) {
            const sample = trace.getStore();
            const start = performance.now();
            const result = await query(args);
            if (sample) {
                const end = performance.now();
                const phase = model === "ITTicketEvent" && operation === "groupBy" ? "aggregation"
                    : model === "ITTicket" && args.select?.id && args.select?.createdAt && args.select?.priority
                        ? "hydration" : "other";
                sample[phase] += end - start;
                sample.lastQueryAt = end;
                sample.operations++;
            }
            return result;
        },
    },
});
const transaction = reader.$transaction.bind(reader);
reader.$transaction = async (callback, options) => {
    const sample = trace.getStore();
    const start = performance.now();
    const result = await transaction(async (tx) => {
        const entered = performance.now();
        const result = await callback(tx);
        const completed = performance.now();
        if (sample) {
            sample.composition = completed - sample.lastQueryAt;
            sample.callback = completed - entered;
        }
        return result;
    }, options);
    if (sample) {
        sample.transaction = performance.now() - start;
        sample.transactionOverhead = sample.transaction - sample.callback;
    }
    return result;
};
globalThis.prisma = reader;
const connection = await mysql.createConnection({ uri: url.toString(), timezone: "Z" });

async function inspectSql(event, includePlan = true, hint = "") {
    const params = JSON.parse(event.params).map((value) =>
        typeof value === "string" && /^\d{4}-\d\d-\d\d[T ]/.test(value) ? new Date(value) : value);
    const sql = event.query.replace(/^SELECT /, `SELECT ${hint}/* it-resolution diagnostic */ `);
    const [rows] = await connection.query(sql, params);
    const [[work]] = await connection.query(`
        SELECT TIMER_WAIT / 1000000000 AS engineMs, CPU_TIME / 1000000000 AS cpuMs,
               ROWS_EXAMINED AS rowsExamined, ROWS_SENT AS rowsSent,
               CREATED_TMP_TABLES AS tempTables, CREATED_TMP_DISK_TABLES AS diskTempTables
        FROM performance_schema.events_statements_history
        WHERE THREAD_ID = PS_CURRENT_THREAD_ID()
          AND (SQL_TEXT LIKE 'SELECT /* it-resolution diagnostic */ %'
            OR SQL_TEXT LIKE 'SELECT /*+ JOIN_PREFIX(it_ticket_events) */ /* it-resolution diagnostic */ %')
        ORDER BY EVENT_ID DESC LIMIT 1`);
    assert.ok(work, "Missing MySQL statement instrumentation");
    assert.equal(work.rowsSent, rows.length);
    if (!includePlan) return { work, rows };
    const [analyzed] = await connection.query("EXPLAIN ANALYZE " + sql, params);
    const [[json]] = await connection.query("EXPLAIN FORMAT=JSON " + sql, params);
    return { explain: analyzed[0].EXPLAIN, plan: JSON.parse(json.EXPLAIN).query_block, work, rows };
}

const statusNames = [
    "Innodb_row_lock_waits", "Innodb_row_lock_time", "Innodb_data_read", "Innodb_data_written",
    "Innodb_os_log_written", "Threads_connected", "Threads_running", "Max_used_connections",
];
const counterNames = [...statusNames.slice(0, 5), "deadlocks", "lockTimeouts"];
async function status() {
    const [rows] = await connection.query("SHOW GLOBAL STATUS WHERE Variable_name IN (?)", [statusNames]);
    const [[errors]] = await connection.query(`
        SELECT SUM(IF(ERROR_NUMBER = 1213, SUM_ERROR_RAISED, 0)) AS deadlocks,
               SUM(IF(ERROR_NUMBER = 1205, SUM_ERROR_RAISED, 0)) AS lockTimeouts
        FROM performance_schema.events_errors_summary_global_by_error
        WHERE ERROR_NUMBER IN (1205, 1213)`);
    return {
        ...Object.fromEntries(rows.map(({ Variable_name, Value }) => [Variable_name, Number(Value)])),
        deadlocks: Number(errors.deadlocks),
        lockTimeouts: Number(errors.lockTimeouts),
    };
}

async function benchmarkWrites({ user, categories, tickets }, context, getDashboard, createEvent, updateTicket) {
    const highWater = (await writer.iTTicketEvent.aggregate({ _max: { id: true } }))._max.id;
    const targets = await writer.iTTicket.findMany({
        where: { id: { in: tickets.slice(0, 4).map(({ id }) => id) } },
    });
    assert.equal(targets.length, 4);
    const batch = tickets.slice(0, 500).map(({ id }, i) => ({
        ticketId: id, actorUserId: user.id, occurredAt: NOW,
        ...[ { kind: "CREATED", toStatus: "OPEN" }, { kind: "STATUS_CHANGED", toStatus: "RESOLVED" },
            { kind: "STATUS_CHANGED", fromStatus: "RESOLVED", toStatus: "IN_PROGRESS" },
            { kind: "PRIORITY_CHANGED", toPriority: "P0" },
            { kind: "CATEGORY_CHANGED", toCategoryId: categories[1].id },
            { kind: "ASSIGNED", toAssigneeUserId: user.id } ][i % 6],
    }));
    async function mutate(target, i) {
        const status = ["RESOLVED", "IN_PROGRESS", "WAITING_REQUESTER", "IN_PROGRESS"][i % 4];
        const categoryId = i % 2 === 0 ? target.categoryId : categories[0].id;
        await writer.$transaction(async (tx) => {
            const current = await tx.iTTicket.findUniqueOrThrow({ where: { id: target.id } });
            assert.ok(await updateTicket(tx, target.id, current.version, {
                status, categoryId, updatedAt: NOW, version: { increment: 1 },
            }));
            await createEvent(tx, {
                ticketId: target.id, actorUserId: user.id,
                occurredAt: new Date(+NOW - 60_000 + i),
                kind: "STATUS_CHANGED", fromStatus: current.status, toStatus: status,
            });
            if (current.categoryId !== categoryId) await createEvent(tx, {
                ticketId: target.id, actorUserId: user.id,
                occurredAt: new Date(+NOW - 60_000 + i),
                kind: "CATEGORY_CHANGED", fromCategoryId: current.categoryId, toCategoryId: categoryId,
            });
        }, { isolationLevel: "Serializable" });
    }
    const cleanup = async () => {
        await writer.iTTicketEvent.deleteMany({ where: { id: { gt: highWater } } });
        for (const { id, status, categoryId, version, updatedAt } of targets) {
            await writer.iTTicket.update({ where: { id }, data: { status, categoryId, version, updatedAt } });
        }
    };
    const concurrent = async (i) => {
        const results = await Promise.allSettled(targets.map((target) => mutate(target, i)));
        const failure = results.find((result) => result.status === "rejected");
        if (failure) throw failure.reason;
    };
    const workloads = [
        ["single", (i) => createEvent(writer, batch[i]), false],
        ["transaction", (i) => mutate(targets[0], i), false],
        ["batch100", () => writer.iTTicketEvent.createMany({ data: batch.slice(0, 100) }), false],
        ["batch500", () => writer.iTTicketEvent.createMany({ data: batch }), false],
        ["concurrent4", concurrent, false],
        ["mixed", concurrent, true],
    ];
    const results = {};
    for (const [name, operation, mixed] of workloads) {
        const durations = [], readerDurations = [];
        let failures = 0;
        const errors = {};
        const run = async (i, measure) => {
            const start = performance.now();
            const work = operation(i).then(
                () => { if (measure) durations.push(performance.now() - start); },
                (error) => {
                    if (!measure) throw error;
                    failures++;
                    const code = error.code ?? error.name;
                    errors[code] = (errors[code] ?? 0) + 1;
                },
            );
            const read = async () => {
                const startRead = performance.now();
                const dto = await getDashboard(context, { period: "30D", category: String(categories[0].id) }, NOW);
                assert.equal(dto.trend.reduce((total, row) => total + row.resolved, 0), dto.summary.resolvedTickets);
                if (measure) readerDurations.push(performance.now() - startRead);
            };
            if (mixed) {
                const results = await Promise.allSettled([work, read()]);
                const failure = results.find((result) => result.status === "rejected");
                if (failure) throw failure.reason;
            } else {
                await work;
            }
        };
        try {
            for (let i = 0; i < WARMUPS; i++) await run(i, false);
            const afterWarmups = await writer.iTTicketEvent.count({ where: { id: { gt: highWater } } });
            const before = await status();
            const cpu = process.cpuUsage();
            const start = performance.now();
            for (let i = 0; i < SAMPLES; i++) await run(i, true);
            const wallMs = performance.now() - start;
            const nodeCpu = process.cpuUsage(cpu);
            const after = await status();
            const inserted = await writer.iTTicketEvent.count({ where: { id: { gt: highWater } } }) - afterWarmups;
            results[name] = {
                latencyMs: stats(durations), readerLatencyMs: stats(readerDurations), failures, errors, retries: 0,
                inserted, eventsPerSecond: rounded(inserted * 1000 / wallMs), nodeCpu,
                statusDelta: Object.fromEntries(counterNames.map((key) => [
                    key, before[key] === undefined || after[key] === undefined ? null : after[key] - before[key],
                ])),
                connections: Object.fromEntries(statusNames.slice(5).map((key) => [key, [before[key], after[key]]])),
            };
        } finally {
            await cleanup();
        }
    }
    return results;
}

try {
    const { getITAnalyticsDashboard } = await tsImport("../modules/it/application/analytics.ts", import.meta.url);
    const { buildITAuthorizationContext } = await tsImport("../modules/it/application/authorization.ts", import.meta.url);
    const { createITTicketEvent, updateITTicketIfVersionMatches } = await tsImport("../modules/it/infrastructure/persistence/ticket-repository.ts", import.meta.url);
    const [[{ version }]] = await connection.query("SELECT VERSION() AS version");
    report({ environment: { mysql: version, prisma: Prisma.prismaVersion.client, node: process.version,
        cpu: os.cpus()[0].model, cores: os.availableParallelism(), memoryBytes: os.totalmem(), now: NOW, warmups: WARMUPS, samples: SAMPLES } });
    await connection.query("SET SESSION information_schema_stats_expiry = 0");
    await connection.query("SET SESSION lock_wait_timeout = 5");
    for (const size of sizes) {
        process.stdout.write(`Seeding ${size} synthetic Tickets\n`);
        const fixture = await seedITResolutionFixture(writer, size);
        const { user, employee, categories } = fixture;
        const context = buildITAuthorizationContext({ id: user.id, role: user.role }, employee.id);
        const [distribution] = await connection.query("SELECT kind, toStatus, COUNT(*) AS events FROM it_ticket_events GROUP BY kind, toStatus");
        const [perTicket] = await connection.query(`
            SELECT resolutions, COUNT(*) AS tickets FROM (
                SELECT COUNT(*) AS resolutions FROM it_ticket_events
                WHERE kind='STATUS_CHANGED' AND toStatus='RESOLVED' GROUP BY ticketId
            ) AS grouped GROUP BY resolutions ORDER BY resolutions`);
        const [scopes] = await connection.query("SELECT type, categoryId, COUNT(*) AS tickets FROM it_tickets GROUP BY type, categoryId");
        report({ size, distribution, perTicket, scopes, categoryKeys: categories.map(({ id, key }) => [id, key]) });
        const reference = new Map();
        for (const [variant, columns] of indexes) {
            let created = false;
            let ddlMs = null;
            try {
                if (columns) {
                    const start = performance.now();
                    await connection.query(`ALTER TABLE it_ticket_events ADD INDEX ${indexName} (${columns}), ALGORITHM=INPLACE, LOCK=NONE`);
                    created = true;
                    ddlMs = rounded(performance.now() - start);
                }
                await connection.query("ANALYZE TABLE it_tickets, it_ticket_events");
                const [[{ indexBytes }]] = await connection.query("SELECT INDEX_LENGTH AS indexBytes FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='it_ticket_events'");
                for (const [scenario, input, now] of scenariosFor(categories)) {
                    const samples = [];
                    let captured;
                    for (let i = -WARMUPS; i < SAMPLES; i++) {
                        const sample = { aggregation: 0, hydration: 0, other: 0, operations: 0 };
                        sqlCapture = [];
                        const cpuStart = process.cpuUsage();
                        const start = performance.now();
                        const dashboard = await trace.run(sample, () => getITAnalyticsDashboard(context, input, now));
                        const serializationStart = performance.now();
                        const serialized = JSON.stringify(dashboard);
                        sample.serialization = performance.now() - serializationStart;
                        sample.application = performance.now() - start;
                        const cpu = process.cpuUsage(cpuStart);
                        sample.nodeCpuMs = (cpu.user + cpu.system) / 1000;
                        captured = sqlCapture;
                        sqlCapture = undefined;
                        sample.statements = captured.filter((event) => /^\s*SELECT/i.test(event.query)).length;
                        sample.rssMiB = process.memoryUsage().rss / 2 ** 20;
                        if (!reference.has(scenario)) reference.set(scenario, { dashboard, hash: digest(dashboard) });
                        const expected = reference.get(scenario);
                        assert.deepEqual(dashboard, expected.dashboard);
                        assert.equal(createHash("sha256").update(serialized).digest("hex"), expected.hash);
                        if (i >= 0) samples.push(sample);
                    }
                    const aggregation = captured.find((event) => event.query.includes("it_ticket_events") && event.query.includes("GROUP BY"));
                    const hydration = captured.find((event) => event.query.includes("it_tickets`.`id` IN (") &&
                        event.query.includes("it_tickets`.`priority`"));
                    assert.ok(aggregation);
                    const { rows: groups, ...plan } = await inspectSql(aggregation);
                    const { rows: hydrated, ...hydrationPlan } = hydration ? await inspectSql(hydration, false) : { rows: [], work: null };
                    const expected = reference.get(scenario);
                    assert.equal(groups.length, expected.dashboard.summary.resolvedTickets);
                    assert.equal(hydrated.length, groups.length);
                    let forcedEventFirst;
                    if (variant === "baseline" && ["combined-30D", "rare-30D"].includes(scenario)) {
                        const { rows, ...forced } = await inspectSql(aggregation, true, "/*+ JOIN_PREFIX(it_ticket_events) */ ");
                        const ordered = (rows) => [...rows].sort((a, b) => a.ticketId - b.ticketId);
                        assert.deepEqual(ordered(rows), ordered(groups));
                        forcedEventFirst = forced;
                    }
                    report({
                        size, variant, scenario, input, now, hash: expected.hash, resolvedTickets: groups.length,
                        metrics: Object.fromEntries(Object.keys(samples[0]).filter((key) => key !== "lastQueryAt")
                            .map((key) => [key, stats(samples.map((sample) => sample[key]))])),
                        aggregation: plan, hydration: hydrationPlan, forcedEventFirst,
                    });
                }
                const writes = await benchmarkWrites(fixture, context, getITAnalyticsDashboard, createITTicketEvent, updateITTicketIfVersionMatches);
                const [[{ instrumentedMysqlBytes }]] = await connection.query(`
                    SELECT SUM(CURRENT_NUMBER_OF_BYTES_USED) AS instrumentedMysqlBytes
                    FROM performance_schema.memory_summary_global_by_event_name`);
                report({ size, variant, indexBytes, ddlMs, instrumentedMysqlBytes: Number(instrumentedMysqlBytes), writes });
            } finally {
                if (created) {
                    const start = performance.now();
                    await connection.query(`ALTER TABLE it_ticket_events DROP INDEX ${indexName}, ALGORITHM=INPLACE, LOCK=NONE`);
                    report({ size, variant, dropMs: rounded(performance.now() - start) });
                }
            }
        }
    }
} finally {
    await connection.end();
    await readerClient.$disconnect();
    await writer.$disconnect();
}
