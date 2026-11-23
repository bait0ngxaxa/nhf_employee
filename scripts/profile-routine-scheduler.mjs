import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Session } from "node:inspector/promises";
import os from "node:os";
import { performance } from "node:perf_hooks";
import { Prisma, PrismaClient } from "@prisma/client";
import { createConnection } from "mysql2/promise";
import { tsImport } from "tsx/esm/api";
import { assertDisposableMysql, validateDisposableTarget } from "./mysql-integration-safety.mjs";

const url = validateDisposableTarget(process.env);
await assertDisposableMysql();
const db = new PrismaClient({ log: [{ level: "query", emit: "event" }] });
globalThis.prisma = db;
const sql = await createConnection({ uri: url.href, timezone: "Z" });
let queryGroups;
db.$on("query", ({ query, duration }) => {
    if (!queryGroups) return;
    const operation = query.split(/\s/, 1)[0];
    const table = query.match(/(?:FROM|INTO|UPDATE)\s+`[^`]+`\.`([a-z_]+)`/i)?.[1] ?? "connection";
    const group = queryGroups[`${operation} ${table}`] ??= { count: 0, clientMs: 0 };
    group.count += 1;
    group.clientMs += duration;
});
const emit = (record) => console.log("SCHEDULER_PROFILE " + JSON.stringify(record));
const stats = (values) => {
    const sorted = values.toSorted((a, b) => a - b);
    return { p50: sorted[Math.ceil(values.length * 0.5) - 1], p95: sorted[Math.ceil(values.length * 0.95) - 1] };
};
async function counters() {
    const [rows] = await sql.query(`SHOW GLOBAL STATUS WHERE Variable_name IN
        ('Com_select', 'Com_delete', 'Com_insert', 'Com_update', 'Com_begin', 'Com_commit', 'Com_rollback',
         'Innodb_row_lock_waits', 'Innodb_row_lock_time', 'Threads_connected')`);
    const [errors] = await sql.query(`SELECT ERROR_NAME AS Variable_name, SUM_ERROR_RAISED AS Value
        FROM performance_schema.events_errors_summary_global_by_error
        WHERE ERROR_NAME IN ('ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT', 'ER_DUP_ENTRY')`);
    return Object.fromEntries([...rows, ...errors].map(({ Variable_name, Value }) => [Variable_name, Number(Value)]));
}

// Server-side timing includes lock time. Filter to the disposable application's
// schema and exclude the profiler's own reads and status commands.
async function statementCounters() {
    const [rows] = await sql.execute(`SELECT DIGEST_TEXT AS shape, COUNT_STAR AS count,
        SUM_TIMER_WAIT / 1000000000 AS ms, SUM_ROWS_EXAMINED AS examined,
        SUM_ROWS_SENT AS sent, SUM_ROWS_AFFECTED AS affected
        FROM performance_schema.events_statements_summary_by_digest
        WHERE SCHEMA_NAME = DATABASE() AND DIGEST_TEXT NOT LIKE '%performance_schema%'
          AND DIGEST_TEXT NOT LIKE 'SHOW %'`);
    return new Map(rows.map(({ shape, ...metrics }) =>
        [shape, Object.fromEntries(Object.entries(metrics).map(([key, value]) => [key, Number(value)]))]));
}

function statementDelta(before, after) {
    const groups = {};
    for (const [shape, current] of after) {
        const previous = before.get(shape);
        if (current.count === (previous?.count ?? 0)) continue;
        const operation = shape.split(" ", 1)[0];
        const table = shape.match(/(?:FROM|INTO|UPDATE)\s+(?:`[^\x60]+`\s*\.\s*)?`([a-z_]+)`/i)?.[1] ?? "connection";
        const group = groups[`${operation} ${table}`] ??= { count: 0, ms: 0, examined: 0, sent: 0, affected: 0 };
        for (const key of Object.keys(group)) group[key] += current[key] - (previous?.[key] ?? 0);
    }
    return groups;
}

async function persistedState() {
    const [occurrences, outbox] = await Promise.all([
        db.routineOccurrence.findMany({
            orderBy: [{ taskId: "asc" }, { periodKey: "asc" }],
            include: { assignees: { orderBy: { employeeId: "asc" } } },
        }),
        db.notificationOutbox.findMany({ orderBy: { eventKey: "asc" } }),
    ]);
    // The disposable lifecycle starts from identical schemas, so IDs and all
    // business timestamps in outbox payloads participate in the comparison.
    const state = {
        occurrences: occurrences.map(({ createdAt: _created, updatedAt: _updated, ...row }) => row),
        outbox: outbox.map(({ id: _id, createdAt: _created, updatedAt: _updated, nextAttemptAt: _next, ...row }) => row),
    };
    return {
        occurrences: occurrences.length,
        outbox: outbox.length,
        sha256: createHash("sha256").update(JSON.stringify(state)).digest("hex"),
    };
}

async function profileCpu(run) {
    const session = new Session();
    session.connect();
    try {
        await session.post("Profiler.enable");
        await session.post("Profiler.start");
        await run();
        const { profile } = await session.post("Profiler.stop");
        const parents = new Map();
        const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
        for (const node of profile.nodes) {
            for (const child of node.children ?? []) parents.set(child, node.id);
        }
        let bangkokDateSamples = 0;
        for (const sample of profile.samples) {
            for (let id = sample; id !== undefined; id = parents.get(id)) {
                if (nodes.get(id).callFrame.functionName === "toBangkokCalendarDate") {
                    bangkokDateSamples += 1;
                    break;
                }
            }
        }
        return { samples: profile.samples.length, bangkokDateSamples };
    } finally {
        session.disconnect();
    }
}

try {
    const { runRoutineScheduler } = await tsImport("../modules/routine/application/scheduler.ts", import.meta.url);
    const now = new Date("2026-11-07T03:00:00Z");
    const department = await db.department.create({ data: { code: "SCHEDULER-PROFILE", name: "Synthetic" } });
    const employee = await db.employee.create({ data: {
        firstName: "Synthetic", lastName: "Scheduler", email: "scheduler-employee@fixture.test", position: "Test", departmentId: department.id,
    } });
    const user = await db.user.create({ data: {
        email: "scheduler@fixture.test", name: "Synthetic", role: "USER", password: "fixture", employeeId: employee.id,
    } });
    const inactiveEmployee = await db.employee.create({ data: {
        firstName: "Synthetic", lastName: "Inactive", email: "scheduler-inactive@fixture.test", position: "Test", departmentId: department.id,
    } });
    await db.user.create({ data: {
        email: "scheduler-inactive-account@fixture.test", name: "Synthetic", isActive: false, password: "fixture", employeeId: inactiveEmployee.id,
    } });
    const unit = await db.routineUnit.create({ data: { code: "SCHEDULER-PROFILE", name: "Synthetic" } });
    const category = await db.routineCategory.create({ data: { name: "Scheduler profile" } });
    const [[server]] = await sql.query("SELECT VERSION() AS mysql");
    emit({ environment: { ...server, node: process.version, prisma: Prisma.prismaVersion.client, cpu: os.cpus()[0].model,
        logicalCpus: os.availableParallelism(), memory: os.totalmem(), now, steadySamples: 20 } });
    const measure = async (parallel, clock = now) => {
        const statementsBefore = await statementCounters();
        const before = await counters();
        const start = performance.now();
        const startCpu = process.cpuUsage();
        const queries = {};
        queryGroups = queries;
        let result;
        try {
            result = parallel
                ? await Promise.all([runRoutineScheduler(clock), runRoutineScheduler(clock)])
                : [await runRoutineScheduler(clock)];
        } finally {
            queryGroups = undefined;
        }
        const elapsed = performance.now() - start;
        const cpu = process.cpuUsage(startCpu);
        const memory = process.memoryUsage();
        const after = await counters();
        const serverQueries = statementDelta(statementsBefore, await statementCounters());
        assert.ok(Object.values(serverQueries).some(({ count }) => count > 0), "MySQL statement digest instrumentation is required");
        return { elapsed, cpu, rss: memory.rss, heapUsed: memory.heapUsed, queries, result,
            connections: [before.Threads_connected, after.Threads_connected],
            serverQueries,
            ...Object.fromEntries(Object.entries(after).filter(([key]) => key !== "Threads_connected")
                .map(([key, value]) => [key, value - before[key]])) };
    };
    let activeTasks = 0;
    const addTasks = async (start, count) => {
        await db.routineTask.createMany({ data: Array.from({ length: count }, (_, index) => ({
            title: "Synthetic " + (start + index), unitId: unit.id, categoryId: category.id, scheduleType: "MONTHLY_DAY",
            scheduleConfig: { day: 10, monthOffset: 0 }, createdById: user.id, updatedById: user.id,
        })) });
        const tasks = await db.routineTask.findMany({ orderBy: { id: "asc" }, skip: start, select: { id: true } });
        await db.routineTaskAssignee.createMany({ data: tasks.map(({ id }) => ({ taskId: id, employeeId: employee.id, role: "OWNER" })) });
        await db.routineReminderRule.createMany({ data: tasks.map(({ id }) => ({
            taskId: id, daysBefore: 3, sendHour: 9, channel: "IN_APP", recipientScope: "ASSIGNEES",
        })) });
        return tasks;
    };
    for (const count of [25, 250, 1_000]) {
        const tasks = await addTasks(activeTasks, count - activeTasks);
        activeTasks = count;
        const initial = await measure(false);
        assert.equal(initial.result[0].errors, 0);
        assert.equal(initial.result[0].outboxEnqueued, tasks.length);
        const initialState = await persistedState();
        emit({ name: "first-generation", activeTasks, newTasks: tasks.length, ...initial, state: initialState });
        const verifySteady = ({result}) => {
            for (const item of result) {
                assert.equal(item.errors, 0);
                assert.equal(item.occurrencesCreated, 0);
                assert.equal(item.outboxEnqueued, 0);
                assert.equal(item.duplicatesSkipped, activeTasks);
            }
        };
        verifySteady(await measure(false));
        verifySteady(await measure(false));
        const steady = [];
        for (let sample = 0; sample < 20; sample++) {
            const row = await measure(false);
            verifySteady(row);
            steady.push(row);
        }
        const steadyState = await persistedState();
        assert.deepEqual(steadyState, initialState);
        emit({ name: "steady-state", activeTasks, state: steadyState,
            latency: stats(steady.map((row) => row.elapsed)), runs: steady });
        if (count !== 1_000) {
            const concurrent = [];
            for (let sample = 0; sample < 5; sample++) {
                const row = await measure(true);
                verifySteady(row);
                concurrent.push(row);
            }
            const concurrentState = await persistedState();
            assert.deepEqual(concurrentState, steadyState);
            emit({ name: "two-concurrent-steady-state", activeTasks, latency: stats(concurrent.map((row) => row.elapsed)),
                runs: concurrent, state: concurrentState });
        }
        if (count === 250) {
            const taskId = tasks[0].id;
            const [future] = await sql.execute(`EXPLAIN ANALYZE SELECT id, periodKey, dueDate, originalDueDate,
                isDueDateOverridden, scheduleVersion FROM routine_occurrences
                WHERE taskId = ? AND dueDate BETWEEN ? AND ?`, [taskId, "2026-11-07", "2027-12-22"]);
            const [safety] = await sql.execute(`EXPLAIN ANALYZE SELECT id, dueDate, originalDueDate
                FROM routine_occurrences WHERE taskId = ? AND dueDate >= ?
                AND (dueDate > ? OR originalDueDate > ? OR originalDueDate < ?) LIMIT 1`,
            [taskId, "2026-11-07", "2027-12-22", "2027-12-22", "2025-09-23"]);
            emit({ name: "plans-and-cpu", activeTasks, future, safety,
                cpuProfile: await profileCpu(async () => verifySteady(await measure(false))) });
        }
    }

    const [shortened, overridden, movedPast, changedSchedule, changedAssignee, extendedReminder, manual] =
        await db.routineTask.findMany({ orderBy: { id: "asc" }, take: 7, select: { id: true } });
    const date = (day) => new Date(`${day}T00:00:00Z`);
    const occurrenceKey = (task, periodKey = "2026-11") =>
        ({ taskId_periodKey: { taskId: task.id, periodKey } });
    await db.routineTask.update({ where: shortened, data: { contractEndDate: date("2026-11-12"), version: { increment: 1 } } });
    await db.routineOccurrence.update({ where: occurrenceKey(overridden), data: {
        dueDate: date("2026-11-12"), isDueDateOverridden: true, reminderVersion: { increment: 1 },
    } });
    await db.routineOccurrence.update({ where: occurrenceKey(movedPast), data: {
        dueDate: date("2026-11-06"), isDueDateOverridden: true, reminderVersion: { increment: 1 },
    } });
    await db.routineTask.updateMany({ where: { id: { in: [overridden.id, movedPast.id] } },
        data: { scheduleConfig: { day: 9, monthOffset: 0 }, version: { increment: 1 } } });
    await db.routineTask.update({ where: changedSchedule, data: {
        scheduleType: "MONTH_END", scheduleConfig: {}, businessDayPolicy: "PREVIOUS_BUSINESS_DAY", version: { increment: 1 },
    } });
    await db.routineTaskAssignee.updateMany({ where: { taskId: changedAssignee.id }, data: { role: "CO_OWNER" } });
    await db.routineTaskAssignee.create({ data: { taskId: changedAssignee.id, employeeId: inactiveEmployee.id, role: "OWNER" } });
    await db.routineOccurrenceAssignee.updateMany({ where: { occurrence: { taskId: changedAssignee.id } },
        data: { employeeId: inactiveEmployee.id } });
    await db.routineOccurrence.updateMany({ where: { taskId: changedAssignee.id }, data: { reminderVersion: { increment: 1 } } });
    await db.routineReminderRule.updateMany({ where: { taskId: extendedReminder.id }, data: { daysBefore: 40 } });
    await db.routineTask.update({ where: manual, data: { scheduleType: "MANUAL" } });
    await addTasks(activeTasks, 10);

    async function scenario(name, clock = now) {
        const measured = await measure(false, clock);
        assert.equal(measured.result[0].errors, 0);
        const state = await persistedState();
        emit({ name, state, ...measured });
        return { state, result: measured.result[0] };
    }

    const mixed = await scenario("mixed-schedule-changes-and-overrides");
    assert.ok(mixed.result.occurrencesCreated >= 30);
    assert.ok(mixed.result.contractOutboxEnqueued > 0);
    assert.ok(mixed.result.noRecipientSkipped > 0);
    assert.equal(await db.routineOccurrence.count({ where: { taskId: shortened.id } }), 1);
    const moveResults = await db.routineOccurrence.findMany({
        where: { taskId: { in: [overridden.id, movedPast.id] }, periodKey: "2026-11" },
        orderBy: { taskId: "asc" },
    });
    assert.deepEqual(moveResults.map(({ dueDate, originalDueDate, isDueDateOverridden, scheduleVersion, reminderVersion }) =>
        [dueDate, originalDueDate, isDueDateOverridden, scheduleVersion, reminderVersion]), [
        [date("2026-11-12"), date("2026-11-09"), true, 2, 3],
        [date("2026-11-06"), date("2026-11-09"), true, 2, 3],
    ]);
    const repeated = await scenario("mixed-repeat");
    assert.deepEqual(repeated.state, mixed.state);
    assert.equal(repeated.result.occurrencesCreated, 0);
    assert.equal(repeated.result.outboxEnqueued, 0);
    const late = await scenario("missed-one-run", new Date("2026-11-09T03:00:00Z"));
    assert.ok(late.result.outboxEnqueued > 0);
    const resume = await scenario("resumed-after-downtime", new Date("2026-12-09T03:00:00Z"));
    assert.ok(resume.result.occurrencesCreated > 0);
    assert.ok(resume.result.outboxEnqueued > 0);
    const resumedAgain = await scenario("resume-repeat", new Date("2026-12-09T03:00:00Z"));
    assert.deepEqual(resumedAgain.state, resume.state);
} finally {
    await sql.end();
    await db.$disconnect();
}
