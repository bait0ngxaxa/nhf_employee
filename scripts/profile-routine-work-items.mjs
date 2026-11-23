import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import os from "node:os";
import { performance } from "node:perf_hooks";
import { setTimeout } from "node:timers/promises";
import { Prisma, PrismaClient } from "@prisma/client";
import { createConnection } from "mysql2/promise";
import { tsImport } from "tsx/esm/api";
import { assertDisposableMysql, validateDisposableTarget } from "./mysql-integration-safety.mjs";

const target = validateDisposableTarget(process.env);
await assertDisposableMysql();
const db = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
globalThis.prisma = db;
const connection = await createConnection({ uri: target.href, timezone: "Z" });

const samples = 20;
const days = [-32, -16, -8, -4, -2, -1, 0, 7, 8, 14];
const dateAt = (today, offset) => new Date(Date.parse(today) + offset * 86_400_000);
const hash = (serialized) => createHash("sha256").update(serialized).digest("hex");
const percentile = (values, fraction) => values.toSorted((a, b) => a - b)[Math.ceil(values.length * fraction) - 1];
const emit = (value) => process.stdout.write(`ROUTINE_PROFILE ${JSON.stringify(value)}\n`);
let queries = [];
db.$on("query", ({ query, params, duration }) => queries.push({ query, params, duration }));

async function statementCounters() {
    // Only this profiler uses the disposable instance. Health checks send PING.
    const [rows] = await connection.query(`SHOW GLOBAL STATUS WHERE Variable_name IN
        ('Com_select', 'Com_begin', 'Com_commit', 'Com_rollback', 'Com_set_option')`);
    return Object.fromEntries(rows.map(({ Variable_name, Value }) => [Variable_name.toLowerCase(), Number(Value)]));
}

async function explain(statements) {
    const seen = new Set();
    const plans = [];
    for (const { query, params } of statements) {
        if (!/^SELECT\b/i.test(query) || !/routine_(occurrences|tasks)/.test(query)) continue;
        const shape = query.replace(/\?(?:,\s*\?)+/g, "?…");
        if (seen.has(shape)) continue;
        seen.add(shape);
        const bindings = JSON.parse(params).map((value) =>
            typeof value === "string" && /^\d{4}-\d\d-\d\d[T ]\d\d:\d\d/.test(value) ? new Date(value) : value,
        );
        const [indexes] = await connection.query(`EXPLAIN ${query}`, bindings);
        const [actual] = await connection.query(`EXPLAIN ANALYZE ${query}`, bindings);
        const tree = actual[0].EXPLAIN.replace(/\b\d+(?:,\s*\d+){9,}/g, "[fixture IDs omitted]");
        plans.push({ shape, indexes, tree });
    }
    return plans;
}

try {
    const { getRoutineTaskWorkItems } = await tsImport("../modules/routine/application/queries.ts", import.meta.url);
    const { getCurrentBangkokDate } = await tsImport("../modules/routine/domain/schedule.ts", import.meta.url);
    const today = getCurrentBangkokDate();
    const department = await db.department.create({ data: { code: "ROUTINE_PROFILE", name: "Synthetic" } });
    const employee = await db.employee.create({ data: {
        firstName: "Synthetic", lastName: "Assignee", email: "assigned@fixture.test", position: "Test", departmentId: department.id,
    } });
    const user = await db.user.create({ data: {
        email: "routine-profile@fixture.test", name: "Synthetic", password: "fixture", role: "USER", employeeId: employee.id,
    } });
    const outsider = await db.user.create({ data: {
        email: "routine-outsider@fixture.test", name: "Synthetic outsider", password: "fixture", role: "USER",
    } });
    await db.userCapabilityGrant.create({ data: { userId: user.id, capabilityKey: "routine.task.read", scope: "ALL" } });
    const actor = { actor: { id: user.id, email: user.email, role: user.role }, employeeId: employee.id };
    const deniedActor = { actor: { id: outsider.id, email: outsider.email, role: outsider.role }, employeeId: null };
    const unit = await db.routineUnit.create({ data: { code: "PROFILE", name: "Synthetic" } });
    const category = await db.routineCategory.create({ data: { name: "Synthetic" } });
    const [[server]] = await connection.query("SELECT VERSION() AS mysql, @@collation_server AS collation");
    emit({ environment: { ...server, node: process.version, prisma: Prisma.prismaVersion.client,
        cpu: os.cpus()[0].model, logicalCpus: os.availableParallelism(), memoryBytes: os.totalmem(), platform: os.release() },
    today, samples, warmups: 2, concurrency: 1 });

    const fixtures = [];
    for (const taskCount of [0, 100, 1_000, 2_500]) {
        while (fixtures.length < taskCount) {
            const offset = fixtures.length;
            const data = Array.from({ length: Math.min(100, taskCount - offset) }, (_, row) => ({
                title: `Synthetic ${String(Math.floor((offset + row) / 2)).padStart(5, "0")}`,
                unitId: unit.id, categoryId: category.id, scheduleType: "MANUAL", createdById: user.id, updatedById: user.id,
            }));
            await db.routineTask.createMany({ data });
            const tasks = await db.routineTask.findMany({
                where: { id: { gt: fixtures.at(-1)?.id ?? 0 } }, orderBy: { id: "asc" }, select: { id: true },
            });
            const assigned = [];
            const occurrences = [];
            for (const [row, task] of tasks.entries()) {
                const index = offset + row;
                const shift = [0, 1, 8, -15][index % 4];
                fixtures.push({ id: task.id, index, shift });
                if (index % 10 === 0) assigned.push({ taskId: task.id, employeeId: employee.id, role: "OWNER" });
                for (const [period, day] of days.entries()) {
                    const due = period === 5 ? shift : day < 0 ? day - 20 : day + shift;
                    occurrences.push({ taskId: task.id, periodKey: `fixture-${period}`, scheduleVersion: 1,
                        dueDate: dateAt(today, due), originalDueDate: dateAt(today, period === 5 ? due + 20 : due),
                        isDueDateOverridden: period === 5 });
                }
            }
            if (assigned.length) await db.routineTaskAssignee.createMany({ data: assigned });
            await db.routineOccurrence.createMany({ data: occurrences });
        }
        await connection.query("ANALYZE TABLE routine_tasks, routine_occurrences");
        const page = Math.max(1, Math.floor(taskCount / 200));
        const scenarios = [
            { name: "all-unfiltered", filters: { scope: "all", page: 1 }, expected: fixtures },
            { name: "all-upcoming-deep", filters: { scope: "all", page, timingStatus: "UPCOMING" }, expected: fixtures.filter((row) => row.shift === 8) },
            { name: "mine-today-to-seven", filters: { scope: "mine", page: 1, dueFrom: today, dueTo: dateAt(today, 7).toISOString().slice(0, 10) },
                expected: fixtures.filter((row) => row.index % 10 === 0 && row.shift === 0) },
        ];
        if (taskCount > 0) {
            const historical = await db.routineOccurrence.findFirstOrThrow({ where: { taskId: fixtures[1].id, periodKey: "fixture-0" } });
            const focus = { taskId: historical.taskId, occurrenceId: historical.id, page: 1, limit: 25, timingStatus: "UPCOMING" };
            const allowed = await getRoutineTaskWorkItems({ ...focus, scope: "all" }, actor);
            assert.equal(allowed.tasks[0]?.relevantOccurrence?.id, historical.id);
            assert.equal(allowed.tasks[0]?.relevantOccurrence?.timingStatus, "OVERDUE");
            assert.deepEqual(await getRoutineTaskWorkItems({ ...focus, scope: "mine" }, deniedActor), {
                tasks: [], pagination: { page: 1, limit: 25, total: 0, pages: 0 },
            });
            await assert.rejects(getRoutineTaskWorkItems({ ...focus, scope: "all" }, deniedActor), { statusCode: 403, code: "FORBIDDEN" });
        }
        for (const { name, filters, expected } of scenarios) {
            const input = { ...filters, limit: 25 };
            const runs = [];
            let digest;
            for (let sample = -2; sample < samples; sample++) {
                globalThis.gc(); // Outside the timer, to cap native Intl allocations across samples.
                const countersBefore = await statementCounters();
                queries = [];
                const cpuStart = process.cpuUsage();
                const started = performance.now();
                const result = await getRoutineTaskWorkItems(input, actor);
                const payload = JSON.stringify(result);
                const elapsedMs = performance.now() - started;
                const cpu = process.cpuUsage(cpuStart);
                const rssBytes = process.memoryUsage().rss;
                const countersAfter = await statementCounters();
                await setTimeout(20); // Drain asynchronous Prisma query-event delivery between samples.
                const delta = (counter) => countersAfter[counter] - countersBefore[counter];
                assert.deepEqual(result.tasks.map((task) => task.id), expected.slice((input.page - 1) * input.limit, input.page * input.limit).map((task) => task.id));
                assert.deepEqual(result.pagination, { page: input.page, limit: input.limit, total: expected.length, pages: Math.ceil(expected.length / input.limit) });
                digest ??= hash(payload);
                assert.equal(hash(payload), digest);
                if (sample >= 0) {
                    runs.push({ elapsedMs, cpuMs: (cpu.user + cpu.system) / 1_000,
                        queryCount: delta("com_select"), prismaSelectEvents: queries.filter(({ query }) => /^SELECT\b/i.test(query)).length,
                        transactionStatements: delta("com_begin") + delta("com_commit") + delta("com_rollback"),
                        setStatements: delta("com_set_option"), prismaMs: queries.reduce((total, query) => total + query.duration, 0), rssBytes });
                }
            }
            const distribution = (metric) => ({ p50: percentile(runs.map((r) => r[metric]), .50), p95: percentile(runs.map((r) => r[metric]), .95) });
            emit({ taskCount, occurrenceCount: taskCount * days.length, name, input, total: expected.length, digest,
                elapsedMs: distribution("elapsedMs"), cpuMs: distribution("cpuMs"), prismaMs: distribution("prismaMs"),
                queryCounts: [...new Set(runs.map((r) => r.queryCount))], transactions: [...new Set(runs.map((r) => r.transactionStatements))],
                peakSampleRssBytes: Math.max(...runs.map((r) => r.rssBytes)), plans: await explain(queries), runs });
        }
    }
    assert.equal(getCurrentBangkokDate(), today, "Benchmark crossed Bangkok midnight");
} finally {
    try {
        await connection.end();
    } finally {
        await db.$disconnect();
    }
}
