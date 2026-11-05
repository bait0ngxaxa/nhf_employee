import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import mysql from "mysql2/promise";

// Deliberately separate from DATABASE_URL and the ordinary integration DB.
const url = new URL(process.env.TEST_DATABASE_URL || "mysql://invalid/invalid");
if (url.protocol !== "mysql:" || !url.pathname.endsWith("_hire_date_cutover_test")) {
    throw new Error("Use an empty, isolated TEST_DATABASE_URL ending in _hire_date_cutover_test");
}
const connection = await mysql.createConnection({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.slice(1)),
    multipleStatements: true,
    dateStrings: true,
});
const sql = await readFile("scripts/employee-hire-date-legacy-remediation.sql", "utf8");
const procedure = sql.slice(sql.indexOf("CREATE PROCEDURE"), sql.indexOf("END$$") + 3);
const receiptSql = await readFile(
    "prisma/migrations/20261105100000_employee_hire_date_cutover_receipt/migration.sql", "utf8",
);
const nullableSql = await readFile(
    "prisma/migrations/20261105090000_employee_hire_date_nullable/migration.sql", "utf8",
);
const ownedTables = [];
let ownsProcedure = false;
let passed = 0;

async function rows(statement) {
    return (await connection.query(statement))[0];
}
async function reset() {
    await connection.query(`
        DELETE FROM audit_logs;
        DELETE FROM employee_hire_date_cutover;
        DELETE FROM employees;
        INSERT INTO employees (id, firstName, lastName, hireDate, createdAt, updatedAt)
        VALUES (7, 'first', 'legacy', '2020-01-01', '2020-01-01', '2020-01-01'),
               (12, 'second', 'legacy', '2021-07-31', '2020-01-01', '2020-01-01'),
               (25, 'unknown', 'legacy', NULL, '2020-01-01', '2020-01-01');
        SET @apply_employee_hire_date_remediation = 1;
        SET @employee_writes_paused = 1;
        SET @operator_email = 'cutover-test@example.org';
        SET @verified_backup_reference = 'isolated-test-backup';
        SET @cutover_deadline_utc = UTC_TIMESTAMP(3) + INTERVAL 30 MINUTE;
        SET @expected_employee_count = 3;
        SET @expected_clear_count = 2;
    `);
}
async function unchangedAfterFailure() {
    assert.deepEqual(await rows("SELECT id, hireDate FROM employees ORDER BY id"), [
        { id: 7, hireDate: "2020-01-01" },
        { id: 12, hireDate: "2021-07-31" },
        { id: 25, hireDate: null },
    ]);
    assert.equal((await rows("SELECT COUNT(*) AS n FROM audit_logs"))[0].n, 0);
    assert.equal((await rows("SELECT COUNT(*) AS n FROM employee_hire_date_cutover"))[0].n, 0);
}
async function test(name, run) {
    await reset();
    await run();
    passed += 1;
    process.stdout.write(`PASS ${name}\n`);
}

try {
    const existing = await rows(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = DATABASE()
          AND table_name IN ('employees', 'audit_logs', 'employee_hire_date_cutover')
    `);
    assert.equal(existing.length, 0, "Refusing existing fixture tables");
    assert.equal((await rows(`SELECT routine_name FROM information_schema.routines
        WHERE routine_schema = DATABASE() AND routine_name = 'clear_legacy_employee_hire_dates'`)).length, 0);
    await connection.query(`CREATE TABLE employees (
        id INT PRIMARY KEY, firstName VARCHAR(191), lastName VARCHAR(191),
        hireDate DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        createdAt DATETIME(3) NOT NULL, updatedAt DATETIME(3) NOT NULL
    ) ENGINE=InnoDB`);
    ownedTables.push("employees");
    await connection.query(`INSERT INTO employees VALUES
        (7, 'first', 'legacy', '2020-01-01 12:34:56.789', '2020-01-01', '2020-01-01')`);
    await connection.query(nullableSql);
    assert.deepEqual(await rows("SELECT id, hireDate FROM employees"), [{ id: 7, hireDate: "2020-01-01" }]);
    await connection.query(`INSERT INTO employees (id, createdAt, updatedAt) VALUES (8, NOW(), NOW())`);
    assert.equal((await rows("SELECT hireDate FROM employees WHERE id = 8"))[0].hireDate, null);
    passed += 1;
    process.stdout.write("PASS actual nullable DATE migration preserves IDs/date and removes default\n");

    await connection.query(`CREATE TABLE audit_logs (
        id INT PRIMARY KEY AUTO_INCREMENT, action ENUM('EMPLOYEE_UPDATE') NOT NULL,
        entityType VARCHAR(191) NOT NULL, entityId INT, userId INT, userEmail VARCHAR(191),
        details TEXT, createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB`);
    ownedTables.push("audit_logs");
    await connection.query(receiptSql);
    ownedTables.push("employee_hire_date_cutover");
    await connection.query(procedure);
    ownsProcedure = true;

    await test("default disabled gate refuses cleanup", async () => {
        await connection.query("SET @apply_employee_hire_date_remediation = NULL");
        await assert.rejects(connection.query("CALL clear_legacy_employee_hire_dates()"), /Cutover refused/);
        await unchangedAfterFailure();
    });
    await test("missing backup, paused writes and expired window fail closed", async () => {
        for (const setting of [
            "SET @verified_backup_reference = NULL",
            "SET @employee_writes_paused = 0",
            "SET @cutover_deadline_utc = UTC_TIMESTAMP(3) - INTERVAL 1 MINUTE",
        ]) {
            await reset();
            await connection.query(setting);
            await assert.rejects(connection.query("CALL clear_legacy_employee_hire_dates()"), /Cutover refused/);
            await unchangedAfterFailure();
        }
    });
    await test("wrong expected counts roll back receipt and all changes", async () => {
        await connection.query("SET @expected_clear_count = 1");
        await assert.rejects(connection.query("CALL clear_legacy_employee_hire_dates()"), /count mismatch/);
        await unchangedAfterFailure();
    });
    await test("audit failure rolls back before cleanup", async () => {
        await connection.query(`CREATE TRIGGER cutover_test_fail BEFORE INSERT ON audit_logs
            FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced audit failure'`);
        try {
            await assert.rejects(connection.query("CALL clear_legacy_employee_hire_dates()"), /forced audit failure/);
            await unchangedAfterFailure();
        } finally {
            await connection.query("DROP TRIGGER cutover_test_fail");
        }
    });
    await test("update failure rolls back already inserted audits", async () => {
        await connection.query(`CREATE TRIGGER cutover_test_fail BEFORE UPDATE ON employees
            FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced update failure'`);
        try {
            await assert.rejects(connection.query("CALL clear_legacy_employee_hire_dates()"), /forced update failure/);
            await unchangedAfterFailure();
        } finally {
            await connection.query("DROP TRIGGER cutover_test_fail");
        }
    });
    await test("silent update mismatch rolls back audits and employee changes", async () => {
        await connection.query(`CREATE TRIGGER cutover_test_fail BEFORE UPDATE ON employees
            FOR EACH ROW SET NEW.hireDate = OLD.hireDate`);
        try {
            await assert.rejects(connection.query("CALL clear_legacy_employee_hire_dates()"), /validation failed/);
            await unchangedAfterFailure();
        } finally {
            await connection.query("DROP TRIGGER cutover_test_fail");
        }
    });
    await test("success clears every legacy date, audits originals, preserves profiles and null rows", async () => {
        const before = await rows("SELECT id, firstName, lastName, createdAt FROM employees ORDER BY id");
        await connection.query("CALL clear_legacy_employee_hire_dates()");
        assert.deepEqual(await rows("SELECT id, firstName, lastName, createdAt FROM employees ORDER BY id"), before);
        assert.equal((await rows("SELECT COUNT(hireDate) AS n FROM employees"))[0].n, 0);
        const audits = await rows("SELECT entityId, userEmail, details, createdAt FROM audit_logs ORDER BY entityId");
        assert.equal(audits.length, 2);
        assert.deepEqual(audits.map((a) => JSON.parse(a.details).before.hireDate), ["2020-01-01", "2021-07-31"]);
        assert.ok(audits.every((a) => a.userEmail === "cutover-test@example.org" && JSON.parse(a.details).after.hireDate === null));
        const receipt = (await rows("SELECT employeeCount, clearedCount, originalValues FROM employee_hire_date_cutover"))[0];
        assert.equal(receipt.employeeCount, 3);
        assert.equal(receipt.clearedCount, 2);
        const snapshot = typeof receipt.originalValues === "string" ? JSON.parse(receipt.originalValues) : receipt.originalValues;
        assert.deepEqual(snapshot.map((s) => s.employeeId).sort((a, b) => a - b), [7, 12, 25]);
        const updated = await rows("SELECT id, updatedAt FROM employees ORDER BY id");
        assert.equal(updated[0].updatedAt, audits[0].createdAt);
        assert.equal(updated[1].updatedAt, audits[0].createdAt);
        assert.equal(updated[2].updatedAt, "2020-01-01 00:00:00.000");

        // New date on an old employee AND a newly created employee survive rerun.
        await connection.query(`UPDATE employees SET hireDate = '2026-11-05' WHERE id = 7;
            INSERT INTO employees VALUES (30, 'new', 'employee', '2026-11-06', NOW(), NOW());
            DELETE FROM audit_logs`);
        await assert.rejects(connection.query("CALL clear_legacy_employee_hire_dates()"), /Duplicate entry/);
        assert.deepEqual(await rows("SELECT id, hireDate FROM employees WHERE hireDate IS NOT NULL ORDER BY id"), [
            { id: 7, hireDate: "2026-11-05" }, { id: 30, hireDate: "2026-11-06" },
        ]);
    });
    await test("all-null and empty cohorts still complete exactly once", async () => {
        await connection.query("UPDATE employees SET hireDate = NULL; SET @expected_clear_count = 0");
        await connection.query("CALL clear_legacy_employee_hire_dates()");
        assert.equal((await rows("SELECT clearedCount FROM employee_hire_date_cutover"))[0].clearedCount, 0);
        await reset();
        await connection.query("DELETE FROM employees; SET @expected_employee_count = 0; SET @expected_clear_count = 0");
        await connection.query("CALL clear_legacy_employee_hire_dates()");
        assert.equal((await rows("SELECT employeeCount FROM employee_hire_date_cutover"))[0].employeeCount, 0);
    });
    process.stdout.write(`${passed} MySQL cutover scenarios passed\n`);
} finally {
    if (ownsProcedure) await connection.query("DROP PROCEDURE IF EXISTS clear_legacy_employee_hire_dates");
    for (const table of ownedTables.reverse()) await connection.query(`DROP TABLE ${table}`);
    await connection.end();
}
