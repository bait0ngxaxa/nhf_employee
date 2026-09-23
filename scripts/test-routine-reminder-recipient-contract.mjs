import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createConnection } from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for the H2B MySQL migration test");
}

const parsedUrl = new URL(databaseUrl);
const databaseName = decodeURIComponent(parsedUrl.pathname.slice(1));
if (
    parsedUrl.protocol !== "mysql:"
    || !/(?:_integration|_test)$/.test(databaseName)
) {
    throw new Error(
        "Refusing H2B migration test: DATABASE_URL must target a MySQL database ending in _integration or _test",
    );
}

const migrationSql = await readFile(
    resolve(
        "prisma/migrations/20260923120000_contract_routine_reminder_recipient_scope/migration.sql",
    ),
    "utf8",
);
const migrationStatements = migrationSql
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);

const connection = await createConnection({
    host: parsedUrl.hostname,
    port: Number(parsedUrl.port || "3306"),
    user: decodeURIComponent(parsedUrl.username),
    password: decodeURIComponent(parsedUrl.password),
    database: databaseName,
});

async function executeMigration() {
    for (const statement of migrationStatements) {
        await connection.query(statement);
    }
}

async function createExpandedShadowTable() {
    await connection.query(
        "DROP TEMPORARY TABLE IF EXISTS _h2b_routine_reminder_collision_guard",
    );
    await connection.query(
        "DROP TEMPORARY TABLE IF EXISTS _h2b_routine_reminder_legacy_assertion",
    );
    await connection.query(
        "DROP TEMPORARY TABLE IF EXISTS routine_reminder_rules",
    );
    await connection.query(`
        CREATE TEMPORARY TABLE routine_reminder_rules (
            id INTEGER NOT NULL AUTO_INCREMENT,
            taskId INTEGER NOT NULL,
            daysBefore INTEGER NOT NULL,
            sendHour INTEGER NOT NULL,
            channel ENUM('IN_APP') NOT NULL DEFAULT 'IN_APP',
            recipientScope ENUM(
                'ASSIGNEES',
                'ADMINS',
                'ASSIGNEES_AND_ADMINS',
                'ALL_READERS',
                'ASSIGNEES_AND_ALL_READERS'
            ) NOT NULL,
            isActive BOOLEAN NOT NULL DEFAULT true,
            createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            updatedAt DATETIME(3) NOT NULL,
            UNIQUE INDEX routine_reminder_rules_unique (
                taskId,
                daysBefore,
                channel,
                recipientScope
            ),
            INDEX routine_reminder_rules_taskId_isActive_idx (taskId, isActive),
            PRIMARY KEY (id)
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
}

async function insertRows(rows) {
    for (const row of rows) {
        await connection.execute(
            `INSERT INTO routine_reminder_rules (
                id, taskId, daysBefore, sendHour, channel, recipientScope,
                isActive, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                row.id,
                row.taskId,
                row.daysBefore,
                row.sendHour,
                row.channel,
                row.recipientScope,
                row.isActive,
                row.createdAt,
                row.updatedAt,
            ],
        );
    }
}

async function readRows() {
    const [rows] = await connection.query(`
        SELECT
            id,
            taskId,
            daysBefore,
            sendHour,
            channel,
            recipientScope,
            isActive,
            DATE_FORMAT(createdAt, '%Y-%m-%d %H:%i:%s.%f') AS createdAt,
            DATE_FORMAT(updatedAt, '%Y-%m-%d %H:%i:%s.%f') AS updatedAt
        FROM routine_reminder_rules
        ORDER BY id
    `);
    return rows;
}

async function readRecipientColumnType() {
    const [columns] = await connection.query(
        "SHOW COLUMNS FROM routine_reminder_rules LIKE 'recipientScope'",
    );
    return columns[0]?.Type;
}

const legacyMappings = new Map([
    ["ADMINS", "ALL_READERS"],
    ["ASSIGNEES_AND_ADMINS", "ASSIGNEES_AND_ALL_READERS"],
]);

async function assertCollisionStopsBeforeBackfill(legacyScope, canonicalScope) {
    await createExpandedShadowTable();
    await insertRows([
        {
            id: 201,
            taskId: 40,
            daysBefore: 3,
            sendHour: 9,
            channel: "IN_APP",
            recipientScope: legacyScope,
            isActive: 1,
            createdAt: "2026-09-23 01:02:03.123",
            updatedAt: "2026-09-23 01:02:03.456",
        },
        {
            id: 202,
            taskId: 40,
            daysBefore: 3,
            sendHour: 9,
            channel: "IN_APP",
            recipientScope: canonicalScope,
            isActive: 0,
            createdAt: "2026-09-22 01:02:03.123",
            updatedAt: "2026-09-22 01:02:03.456",
        },
    ]);
    const before = await readRows();

    await assert.rejects(
        executeMigration(),
        (error) => error?.code === "ER_DUP_ENTRY",
    );

    assert.deepEqual(await readRows(), before);
    const columnType = await readRecipientColumnType();
    assert.match(columnType, /ADMINS/);
    assert.match(columnType, /ASSIGNEES_AND_ADMINS/);
    process.stdout.write(
        `H2B collision guard rejected ${legacyScope} + ${canonicalScope} without changing rows or the expanded enum\n`,
    );
}

async function assertBackfillAndContraction() {
    await createExpandedShadowTable();
    const fixtureRows = [
        {
            id: 101,
            taskId: 40,
            daysBefore: 1,
            sendHour: 9,
            channel: "IN_APP",
            recipientScope: "ADMINS",
            isActive: 1,
            createdAt: "2026-09-23 01:02:03.123",
            updatedAt: "2026-09-23 01:02:03.456",
        },
        {
            id: 102,
            taskId: 40,
            daysBefore: 2,
            sendHour: 10,
            channel: "IN_APP",
            recipientScope: "ASSIGNEES_AND_ADMINS",
            isActive: 0,
            createdAt: "2026-09-22 01:02:03.123",
            updatedAt: "2026-09-22 01:02:03.456",
        },
        {
            id: 103,
            taskId: 40,
            daysBefore: 3,
            sendHour: 11,
            channel: "IN_APP",
            recipientScope: "ALL_READERS",
            isActive: 1,
            createdAt: "2026-09-21 01:02:03.123",
            updatedAt: "2026-09-21 01:02:03.456",
        },
        {
            id: 104,
            taskId: 40,
            daysBefore: 4,
            sendHour: 12,
            channel: "IN_APP",
            recipientScope: "ASSIGNEES_AND_ALL_READERS",
            isActive: 1,
            createdAt: "2026-09-20 01:02:03.123",
            updatedAt: "2026-09-20 01:02:03.456",
        },
        {
            id: 105,
            taskId: 40,
            daysBefore: 5,
            sendHour: 13,
            channel: "IN_APP",
            recipientScope: "ASSIGNEES",
            isActive: 0,
            createdAt: "2026-09-19 01:02:03.123",
            updatedAt: "2026-09-19 01:02:03.456",
        },
    ];
    await insertRows(fixtureRows);
    const before = await readRows();

    assert.equal(before.length, 5);
    assert.equal(
        before.filter((row) => row.recipientScope === "ADMINS").length,
        1,
    );
    assert.equal(
        before.filter((row) => row.recipientScope === "ASSIGNEES_AND_ADMINS").length,
        1,
    );

    await executeMigration();

    const after = await readRows();
    const expected = before.map((row) => ({
        ...row,
        recipientScope: legacyMappings.get(row.recipientScope) ?? row.recipientScope,
    }));
    assert.deepEqual(after, expected);
    assert.equal(after.length, 5);
    assert.equal(
        after.some((row) => legacyMappings.has(row.recipientScope)),
        false,
    );
    assert.equal(
        await readRecipientColumnType(),
        "enum('ASSIGNEES','ALL_READERS','ASSIGNEES_AND_ALL_READERS')",
    );

    const [modeRows] = await connection.query(
        "SELECT @@SESSION.sql_mode AS sqlMode",
    );
    assert.match(modeRows[0]?.sqlMode, /STRICT_(?:TRANS_TABLES|ALL_TABLES)/);
    for (const legacyScope of legacyMappings.keys()) {
        await assert.rejects(
            connection.execute(
                `INSERT INTO routine_reminder_rules (
                    taskId, daysBefore, sendHour, channel, recipientScope, isActive,
                    createdAt, updatedAt
                ) VALUES (40, 100, 9, 'IN_APP', ?, true,
                    '2026-09-23 01:02:03.123', '2026-09-23 01:02:03.456')`,
                [legacyScope],
            ),
        );
    }
    await assert.rejects(
        connection.execute(`
            INSERT INTO routine_reminder_rules (
                taskId, daysBefore, sendHour, channel, recipientScope, isActive,
                createdAt, updatedAt
            ) VALUES (40, 5, 9, 'IN_APP', 'ASSIGNEES', true,
                '2026-09-23 01:02:03.123', '2026-09-23 01:02:03.456')
        `),
        (error) => error?.code === "ER_DUP_ENTRY",
    );
    assert.deepEqual(await readRows(), expected);
    process.stdout.write(
        "H2B migration backfilled 1 ADMINS and 1 ASSIGNEES_AND_ADMINS row, preserved all 5 fixture rows and non-scope fields, contracted the enum, rejected legacy inserts, and retained uniqueness\n",
    );
}

try {
    await assertCollisionStopsBeforeBackfill("ADMINS", "ALL_READERS");
    await assertCollisionStopsBeforeBackfill(
        "ASSIGNEES_AND_ADMINS",
        "ASSIGNEES_AND_ALL_READERS",
    );
    await assertBackfillAndContraction();
} finally {
    await connection.end();
}
