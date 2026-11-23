import assert from "node:assert/strict";
import os from "node:os";
import { performance } from "node:perf_hooks";
import { Prisma, PrismaClient } from "@prisma/client";
import { createConnection } from "mysql2/promise";
import { tsImport } from "tsx/esm/api";
import { assertDisposableMysql, validateDisposableTarget } from "./mysql-integration-safety.mjs";

const url = validateDisposableTarget(process.env);
await assertDisposableMysql();
const db = new PrismaClient();
globalThis.prisma = db;
const sql = await createConnection({ uri: url.href, timezone: "Z" });
const emit = (record) => console.log("SCHEDULER_PROFILE " + JSON.stringify(record));
const stats = (values) => {
    const sorted = values.toSorted((a,b) => a-b);
    return { p50: sorted[Math.ceil(values.length * 0.5) - 1], p95: sorted[Math.ceil(values.length * 0.95) - 1] };
};
async function counters() {
    const [rows] = await sql.query(`SHOW GLOBAL STATUS WHERE Variable_name IN
        ('Com_select', 'Com_begin', 'Com_commit', 'Com_rollback', 'Innodb_row_lock_waits', 'Innodb_row_lock_time', 'Innodb_deadlocks')`);
    return Object.fromEntries(rows.map(({ Variable_name, Value }) => [Variable_name, Number(Value)]));
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
    const unit = await db.routineUnit.create({ data: { code: "SCHEDULER-PROFILE", name: "Synthetic" } });
    const category = await db.routineCategory.create({ data: { name: "Scheduler profile" } });
    const [[server]] = await sql.query("SELECT VERSION() AS mysql");
    emit({ environment: { ...server, node: process.version, prisma: Prisma.prismaVersion.client, cpu: os.cpus()[0].model,
        logicalCpus: os.availableParallelism(), memory: os.totalmem(), now, steadySamples: 20 } });
    const measure = async (parallel) => {
        const before = await counters();
        const start = performance.now();
        const result = parallel
            ? await Promise.all([runRoutineScheduler(now), runRoutineScheduler(now)])
            : [await runRoutineScheduler(now)];
        const elapsed = performance.now() - start;
        const after = await counters();
        return { elapsed, rss: process.memoryUsage().rss, result,
            ...Object.fromEntries(Object.entries(after).map(([key, value]) => [key, value - before[key]])) };
    };
    let activeTasks = 0;
    for (const count of [25, 250]) {
        await db.routineTask.createMany({ data: Array.from({ length: count - activeTasks }, (_, index) => ({
            title: "Synthetic " + (activeTasks + index), unitId: unit.id, categoryId: category.id, scheduleType: "MONTHLY_DAY",
            scheduleConfig: { day: 10, monthOffset: 0 }, createdById: user.id, updatedById: user.id,
        })) });
        const tasks = await db.routineTask.findMany({ orderBy: { id: "asc" }, skip: activeTasks, select: { id: true } });
        await db.routineTaskAssignee.createMany({ data: tasks.map(({ id }) => ({ taskId: id, employeeId: employee.id, role: "OWNER" })) });
        await db.routineReminderRule.createMany({ data: tasks.map(({ id }) => ({
            taskId: id, daysBefore: 3, sendHour: 9, channel: "IN_APP", recipientScope: "ASSIGNEES",
        })) });
        activeTasks = count;
        const initial = await measure(false);
        assert.equal(initial.result[0].errors, 0);
        assert.equal(initial.result[0].outboxEnqueued, tasks.length);
        emit({ name: "first-generation", activeTasks, newTasks: tasks.length, ...initial });
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
        emit({ name: "steady-state", activeTasks, occurrences: await db.routineOccurrence.count(),
            reminders: await db.notificationOutbox.count(), latency: stats(steady.map((row) => row.elapsed)), runs: steady });
        if (count === 25) {
            const concurrent = [];
            for (let sample = 0; sample < 5; sample++) {
                const row = await measure(true);
                verifySteady(row);
                concurrent.push(row);
            }
            emit({ name: "two-concurrent-steady-state", activeTasks, latency: stats(concurrent.map((row) => row.elapsed)), runs: concurrent });
        }
    }
} finally {
    await sql.end();
    await db.$disconnect();
}
