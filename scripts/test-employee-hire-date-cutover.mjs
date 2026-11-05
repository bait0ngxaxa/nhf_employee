import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { extractCutoverProcedure } from "./employee-hire-date-cli.mjs";

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
const sql = await readFile(new URL("employee-hire-date-legacy-remediation.sql", import.meta.url), "utf8");
const procedure = extractCutoverProcedure(sql);
const receiptSql = await readFile(
    new URL("../prisma/migrations/20261105100000_employee_hire_date_cutover_receipt/migration.sql", import.meta.url), "utf8",
);
const nullableSql = await readFile(
    new URL("../prisma/migrations/20261105090000_employee_hire_date_nullable/migration.sql", import.meta.url), "utf8",
);
const ownedTables = [];
let ownsProcedure = false;
let passed = 0;
const execFileAsync = promisify(execFile);
const target = `${url.hostname}:${url.port || 3306}/${decodeURIComponent(url.pathname.slice(1))}`;
const applyArgs = ["cutover", "--apply", "--operator=cli-test@example.org", "--backup-ref=cli-verified-backup",
    "--confirm-writers-paused", `--confirm-target=${target}`];

async function cli(args) {
    try {
        const result = await execFileAsync(process.execPath,
            [fileURLToPath(new URL("employee-hire-date-cli.mjs", import.meta.url)), ...args], {
                // Exercise path independence and prevent loading a normal developer DB.
                cwd: tmpdir(),
                env: { ...process.env, DATABASE_URL: url.href, EMPLOYEE_HIRE_DATE_DATABASE_URL: url.href },
            });
        return { code: 0, output: result.stdout + result.stderr };
    } catch (error) {
        if (typeof error.code !== "number") throw error;
        return { code: error.code, output: error.stdout + error.stderr };
    }
}

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
    assert.equal((await rows(`SELECT table_name FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = '_prisma_migrations'`)).length, 0,
    "Use an empty test DB; never overwrite Prisma migration history");
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
    await test("silently corrupted audit details fail actual audit-count validation", async () => {
        await connection.query(`CREATE TRIGGER cutover_test_fail BEFORE INSERT ON audit_logs
            FOR EACH ROW SET NEW.details = JSON_OBJECT('unexpected', true)`);
        try {
            await assert.rejects(connection.query("CALL clear_legacy_employee_hire_dates()"), /validation failed/);
            await unchangedAfterFailure();
        } finally {
            await connection.query("DROP TRIGGER cutover_test_fail");
        }
    });
    await test("receipt failure rolls back employee changes and audits", async () => {
        await connection.query(`CREATE TRIGGER cutover_test_fail BEFORE UPDATE ON employee_hire_date_cutover
            FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced receipt failure'`);
        try {
            await assert.rejects(connection.query("CALL clear_legacy_employee_hire_dates()"), /forced receipt failure/);
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
    await connection.query("DROP PROCEDURE clear_legacy_employee_hire_dates");
    ownsProcedure = false;
    // Minimal isolated migration-history fixture for CLI preflight; never a live Prisma history.
    await connection.query(`CREATE TABLE _prisma_migrations (
        migration_name VARCHAR(255), finished_at DATETIME(3), rolled_back_at DATETIME(3)
    ) ENGINE=InnoDB`);
    ownedTables.push("_prisma_migrations");
    await connection.query(`INSERT INTO _prisma_migrations VALUES
        ('20261105090000_employee_hire_date_nullable', NOW(3), NULL),
        ('20261105100000_employee_hire_date_cutover_receipt', NOW(3), NULL)`);

    await test("CLI assess and default cutover are read-only across working directories", async () => {
        for (const command of ["assess", "cutover"]) {
            const result = await cli([command]);
            assert.equal(result.code, 0, result.output);
            assert.match(result.output, /Total employees: 3/);
            assert.match(result.output, /Non-null hire dates: 2/);
            await unchangedAfterFailure();
        }
        const result = await cli(["verify"]);
        assert.equal(result.code, 1);
        assert.match(result.output, /CUTOVER_NOT_COMPLETED/);
    });
    await test("CLI refuses missing migration and target mismatch without changes", async () => {
        await connection.query("DELETE FROM _prisma_migrations WHERE migration_name = '20261105090000_employee_hire_date_nullable'");
        const missing = await cli(["assess"]);
        assert.equal(missing.code, 1);
        assert.match(missing.output, /migrations are missing/);
        await connection.query("INSERT INTO _prisma_migrations VALUES ('20261105090000_employee_hire_date_nullable', NOW(3), NULL)");
        const mismatch = await cli([...applyArgs.slice(0, -1), "--confirm-target=wrong:3306/wrong"]);
        assert.equal(mismatch.code, 1);
        await unchangedAfterFailure();
    });
    await test("CLI refuses an existing routine and never drops another owner's routine", async () => {
        await connection.query(procedure);
        try {
            const result = await cli(applyArgs);
            assert.equal(result.code, 1);
            assert.match(result.output, /routine already exists/);
            assert.equal((await rows(`SELECT routine_name FROM information_schema.routines
                WHERE routine_schema = DATABASE() AND routine_name = 'clear_legacy_employee_hire_dates'`)).length, 1);
            await unchangedAfterFailure();
        } finally {
            await connection.query("DROP PROCEDURE clear_legacy_employee_hire_dates");
        }
    });
    await test("CLI refuses concurrent setup lock without installing a routine", async () => {
        const { createHash } = await import("node:crypto");
        const lockName = `nhf_hire_date_${createHash("sha256").update(decodeURIComponent(url.pathname.slice(1))).digest("hex").slice(0, 40)}`;
        await connection.query("SELECT GET_LOCK(?, 0)", [lockName]);
        try {
            const result = await cli(applyArgs);
            assert.equal(result.code, 1);
            assert.match(result.output, /setup lock/);
            await unchangedAfterFailure();
        } finally {
            await connection.query("SELECT RELEASE_LOCK(?)", [lockName]);
        }
    });
    await test("CLI procedure failure returns nonzero, rolls back and removes only its own routine", async () => {
        await connection.query(`CREATE TRIGGER cutover_test_fail BEFORE UPDATE ON employees
            FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced CLI rollback'`);
        try {
            const result = await cli(applyArgs);
            assert.equal(result.code, 1);
            assert.match(result.output, /No automatic retry/);
            await unchangedAfterFailure();
            assert.equal((await rows(`SELECT routine_name FROM information_schema.routines
                WHERE routine_schema = DATABASE() AND routine_name = 'clear_legacy_employee_hire_dates'`)).length, 0);
        } finally {
            await connection.query("DROP TRIGGER cutover_test_fail");
        }
    });
    await test("CLI count mismatch inside the authoritative transaction rolls everything back", async () => {
        // Simulate a cohort change after CLI counts, before the locked SQL snapshot.
        await connection.query(`CREATE TRIGGER cutover_test_fail BEFORE INSERT ON employee_hire_date_cutover
            FOR EACH ROW UPDATE employees SET hireDate = NULL WHERE id = 12`);
        try {
            const result = await cli(applyArgs);
            assert.equal(result.code, 1);
            await unchangedAfterFailure();
        } finally {
            await connection.query("DROP TRIGGER cutover_test_fail");
        }
    });
    await test("CLI apply obtains fresh counts rather than trusting an earlier dry run", async () => {
        const dry = await cli(["cutover"]);
        assert.equal(dry.code, 0);
        assert.match(dry.output, /Non-null hire dates: 2/);
        await connection.query("UPDATE employees SET hireDate = NULL WHERE id = 12");
        const result = await cli(applyArgs);
        assert.equal(result.code, 0, result.output);
        assert.equal((await rows("SELECT clearedCount FROM employee_hire_date_cutover"))[0].clearedCount, 1);
    });
    await test("CLI apply, verify, new dates and rerun protection use the actual SQL", async () => {
        const applied = await cli(applyArgs);
        assert.equal(applied.code, 0, applied.output);
        assert.match(applied.output, /CUTOVER_VERIFIED/);
        assert.equal((await rows("SELECT COUNT(*) AS n FROM employee_hire_date_cutover"))[0].n, 1);
        const verified = await cli(["verify"]);
        assert.equal(verified.code, 0, verified.output);
        await connection.query(`UPDATE employees SET hireDate = '2026-11-05' WHERE id = 7;
            INSERT INTO employees VALUES (30, 'new', 'employee', '2026-11-06', NOW(), NOW())`);
        const withNew = await cli(["verify"]);
        assert.equal(withNew.code, 0, withNew.output);
        assert.match(withNew.output, /CUTOVER_VERIFIED_WITH_NEW_DATES/);
        const repeated = await cli(applyArgs);
        assert.equal(repeated.code, 1);
        assert.match(repeated.output, /already completed/);
        assert.equal((await rows("SELECT COUNT(hireDate) AS n FROM employees"))[0].n, 2);
        const assess = await cli(["assess"]);
        assert.equal(assess.code, 0);
        assert.match(assess.output, /Cleanup must NOT be repeated/);
    });
    await test("CLI verification rejects corrupted durable receipt", async () => {
        const applied = await cli(applyArgs);
        assert.equal(applied.code, 0, applied.output);
        await connection.query("UPDATE employee_hire_date_cutover SET clearedCount = employeeCount + 1");
        const result = await cli(["verify"]);
        assert.equal(result.code, 1);
        assert.match(result.output, /VERIFICATION_FAILED/);
        assert.equal((await rows("SELECT COUNT(*) AS n FROM employee_hire_date_cutover"))[0].n, 1);
    });
    process.stdout.write(`${passed} MySQL cutover scenarios passed\n`);
} finally {
    if (ownsProcedure) await connection.query("DROP PROCEDURE IF EXISTS clear_legacy_employee_hire_dates");
    for (const table of ownedTables.reverse()) await connection.query(`DROP TABLE ${table}`);
    await connection.end();
}
