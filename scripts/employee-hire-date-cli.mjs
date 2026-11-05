import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import nextEnv from "@next/env";
import mysql from "mysql2/promise";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const ROUTINE = "clear_legacy_employee_hire_dates";
const MIGRATIONS = [
    "20261105090000_employee_hire_date_nullable",
    "20261105100000_employee_hire_date_cutover_receipt",
];
const HELP = `Usage: node scripts/employee-hire-date-cli.mjs assess|cutover|verify
cutover defaults to a read-only dry run. Apply requires ALL of:
  --apply --operator=EMAIL --backup-ref=REFERENCE
  --confirm-writers-paused --confirm-target=HOST:PORT/DATABASE
Stop all employee writers and verify a restorable backup first.
Use DATABASE_URL or explicit EMPLOYEE_HIRE_DATE_DATABASE_URL (no fallback).
--help displays this message without connecting.`;

class CutoverError extends Error {}

/** @returns {{command: string, values: Record<string, string | boolean | undefined>}} */
export function parseCutoverArgs(args) {
    const [command, ...flags] = args;
    if (!["assess", "cutover", "verify"].includes(command)) {
        throw new CutoverError("Expected assess, cutover or verify. Use a command with --help.");
    }
    let parsed;
    try {
        parsed = parseArgs({ args: flags, strict: true, tokens: true, options: {
            help: { type: "boolean" },
            ...(command === "cutover" ? {
                apply: { type: "boolean" },
                operator: { type: "string" },
                "backup-ref": { type: "string" },
                "confirm-target": { type: "string" },
                "confirm-writers-paused": { type: "boolean" },
            } : {}),
        } });
    } catch {
        throw new CutoverError("Unsupported or malformed arguments. Use --help.");
    }
    const names = parsed.tokens.map((token) => token.name);
    if (new Set(names).size !== names.length) throw new CutoverError("Duplicate options are not allowed.");
    if (parsed.values.help && flags.length !== 1) throw new CutoverError("Use --help on its own.");
    if (parsed.values.apply) {
        for (const [name, max] of [["operator", 191], ["backup-ref", 255]]) {
            const value = parsed.values[name];
            if (typeof value !== "string" || !value.trim() || value.length > max || /[\x00-\x1f\x7f]/.test(value)) {
                throw new CutoverError(`--${name} must be non-empty, printable and at most ${max} characters.`);
            }
        }
        if (!parsed.values["confirm-writers-paused"] || !parsed.values["confirm-target"]) {
            throw new CutoverError("Apply requires --confirm-writers-paused and --confirm-target.");
        }
    }
    return { command, values: parsed.values };
}

/** @returns {{target: string, database: string, connection: object}} */
export function cutoverDatabaseConfig(env) {
    try {
        const raw = env.EMPLOYEE_HIRE_DATE_DATABASE_URL !== undefined
            ? env.EMPLOYEE_HIRE_DATE_DATABASE_URL : env.DATABASE_URL;
        const url = new URL(raw);
        const database = decodeURIComponent(url.pathname.slice(1));
        if (url.protocol !== "mysql:" || !url.hostname || !/^[A-Za-z0-9_$-]+$/.test(database) || url.hash) throw new Error();
        const port = Number(url.port || 3306);
        if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error();
        const allowed = new Set(["connection_limit", "pool_timeout", "connect_timeout", "sslaccept", "sslcert"]);
        if ([...url.searchParams.keys()].some((key) => !allowed.has(key))) throw new Error();
        for (const key of url.searchParams.keys()) {
            if (url.searchParams.getAll(key).length !== 1) throw new Error();
        }
        const sslAccept = url.searchParams.get("sslaccept");
        if (sslAccept !== null && sslAccept !== "strict") throw new Error();
        let ssl;
        if (sslAccept || url.searchParams.has("sslcert")) {
            ssl = { rejectUnauthorized: true, verifyIdentity: true };
            if (url.searchParams.has("sslcert")) ssl.ca = readFileSync(resolve(ROOT, url.searchParams.get("sslcert")));
        }
        const connectTimeout = Number(url.searchParams.get("connect_timeout") || 10) * 1000;
        if (!Number.isFinite(connectTimeout) || connectTimeout < 1000 || connectTimeout > 60_000) throw new Error();
        return {
            target: `${url.hostname}:${port}/${database}`,
            database,
            connection: {
                host: url.hostname.replace(/^\[|\]$/g, ""), port, database,
                user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
                ssl, connectTimeout, multipleStatements: false, dateStrings: true, timezone: "Z",
            },
        };
    } catch {
        throw new CutoverError("Invalid database configuration or TLS file. Check the selected URL; no fallback was attempted.");
    }
}

/** Extract only the known, version-controlled procedure; never execute its CLI wrapper. @returns {string} */
export function extractCutoverProcedure(sql) {
    const text = sql.replace(/\r\n/g, "\n");
    const parts = text.split("DELIMITER $$\n");
    const prefix = parts[0].split("\n").filter((line) => line && !line.startsWith("--")).join("\n");
    const expectedPrefix = [
        "SET @apply_employee_hire_date_remediation = COALESCE(@apply_employee_hire_date_remediation, 0);",
        "SET @employee_writes_paused = COALESCE(@employee_writes_paused, 0);",
        `DROP PROCEDURE IF EXISTS ${ROUTINE};`,
    ].join("\n");
    const body = parts[1]?.split("END$$\nDELIMITER ;\n");
    if (parts.length !== 2 || prefix !== expectedPrefix || body?.length !== 2
        || body[1].trim() !== `CALL ${ROUTINE}();\nDROP PROCEDURE ${ROUTINE};`
        || !body[0].startsWith(`CREATE PROCEDURE ${ROUTINE}()\nSQL SECURITY INVOKER\nBEGIN\n`)
        || body[0].includes("$$") || (body[0].match(/CREATE PROCEDURE/g) || []).length !== 1) {
        throw new CutoverError("Unexpected cleanup SQL structure. Refusing procedure installation.");
    }
    return `${body[0]}END`;
}

async function queryRows(connection, sql, values = []) {
    return (await (values.length ? connection.execute(sql, values) : connection.query(sql)))[0];
}

async function inspect(connection, database) {
    const [server] = await queryRows(connection, "SELECT DATABASE() AS db, VERSION() AS version");
    if (server.db !== database || !/^8\./.test(server.version) || /MariaDB/i.test(server.version)) {
        throw new CutoverError("Expected the confirmed database on MySQL 8.");
    }
    const migrations = await queryRows(connection, `SELECT DISTINCT migration_name FROM _prisma_migrations
        WHERE migration_name IN (?, ?) AND finished_at IS NOT NULL AND rolled_back_at IS NULL`, MIGRATIONS);
    if (!MIGRATIONS.every((name) => migrations.some((m) => m.migration_name === name))) {
        throw new CutoverError("Required hire-date migrations are missing. Apply Prisma migrations separately.");
    }
    const columns = await queryRows(connection, `SELECT data_type AS dataType, is_nullable AS nullable, column_default AS defaultValue
        FROM information_schema.columns WHERE table_schema = DATABASE()
        AND table_name = 'employees' AND column_name = 'hireDate'`);
    const engines = await queryRows(connection, `SELECT table_name FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name IN ('employees', 'audit_logs', 'employee_hire_date_cutover')
        AND engine = 'InnoDB'`);
    if (columns.length !== 1 || columns[0].dataType !== "date" || columns[0].nullable !== "YES"
        || columns[0].defaultValue !== null || engines.length !== 3) {
        throw new CutoverError("Required nullable DATE/receipt/audit schema is not ready.");
    }
    const [counts] = await queryRows(connection, "SELECT COUNT(*) AS employees, COUNT(hireDate) AS nonNull FROM employees");
    const receipts = await queryRows(connection, `SELECT id, completedAt, operatorEmail, backupReference,
        employeeCount, clearedCount, originalValues, completedAt <= UTC_TIMESTAMP(3) AS notFuture
        FROM employee_hire_date_cutover`);
    return { counts, receipts };
}

function parseJson(value) {
    try { return typeof value === "string" ? JSON.parse(value) : value; }
    catch { throw new CutoverError("Invalid cutover receipt/audit JSON."); }
}

function validDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

async function verifyReceipt(connection, report) {
    if (report.receipts.length !== 1) throw new CutoverError("Expected exactly one completed cutover receipt.");
    const receipt = report.receipts[0];
    const snapshot = parseJson(receipt.originalValues);
    if (receipt.id !== 1 || !receipt.notFuture || !receipt.completedAt
        || typeof receipt.operatorEmail !== "string" || !receipt.operatorEmail.trim()
        || typeof receipt.backupReference !== "string" || !receipt.backupReference.trim()
        || !Number.isSafeInteger(receipt.employeeCount) || receipt.employeeCount < 0
        || !Number.isSafeInteger(receipt.clearedCount) || receipt.clearedCount < 0
        || receipt.clearedCount > receipt.employeeCount
        || !Array.isArray(snapshot) || snapshot.length !== receipt.employeeCount) {
        throw new CutoverError("Invalid cutover receipt metadata/counts.");
    }
    const ids = new Set();
    const cleared = new Map();
    for (const row of snapshot) {
        if (!row || !Number.isSafeInteger(row.employeeId) || row.employeeId <= 0 || ids.has(row.employeeId)
            || typeof row.updatedAt !== "string" || !row.updatedAt
            || (row.hireDate !== null && !validDate(row.hireDate))) {
            throw new CutoverError("Invalid cutover employee snapshot.");
        }
        ids.add(row.employeeId);
        if (row.hireDate !== null) cleared.set(row.employeeId, row.hireDate);
    }
    if (cleared.size !== receipt.clearedCount) throw new CutoverError("Receipt snapshot count mismatch.");
    const audits = await queryRows(connection, `SELECT entityId, userEmail, createdAt, details FROM audit_logs
        WHERE entityType = 'Employee' AND action = 'EMPLOYEE_UPDATE'
        AND CASE WHEN JSON_VALID(details) THEN JSON_UNQUOTE(JSON_EXTRACT(details, '$.metadata.reason')) END
            = 'legacy_hire_date_cutover'`);
    if (audits.length !== cleared.size) {
        throw new CutoverError("Audit evidence is incomplete (possibly expired). Preserve the receipt; do not repeat cleanup. Review archived evidence.");
    }
    for (const audit of audits) {
        const detail = parseJson(audit.details);
        if (!cleared.has(audit.entityId) || detail?.before?.hireDate !== cleared.get(audit.entityId)
            || detail?.after?.hireDate !== null || detail?.metadata?.cutoverId !== 1
            || detail?.metadata?.backupReference !== receipt.backupReference
            || typeof detail?.metadata?.databaseActor !== "string" || !detail.metadata.databaseActor
            || audit.userEmail !== receipt.operatorEmail || audit.createdAt !== receipt.completedAt) {
            throw new CutoverError("Cutover audit evidence does not match the receipt.");
        }
        cleared.delete(audit.entityId);
    }
    return report.counts.nonNull > 0 ? "CUTOVER_VERIFIED_WITH_NEW_DATES" : "CUTOVER_VERIFIED";
}

function printReport(write, target, report) {
    write(`Employee Hire Date Assessment\n\nDatabase: ${target}\nSchema: READY\nCutover: ${report.receipts.length ? "COMPLETED_RECEIPT_PRESENT" : "NOT_COMPLETED"}\n\nTotal employees: ${report.counts.employees}\nNon-null hire dates: ${report.counts.nonNull}\nAlready NULL: ${report.counts.employees - report.counts.nonNull}\n`);
    if (report.receipts.length) {
        const r = report.receipts[0];
        // Keep arbitrary operator/backup strings in the DB, not in console logs.
        write(`Receipt: ${JSON.stringify({ id: r.id, completedAt: r.completedAt, employees: r.employeeCount, cleared: r.clearedCount })}\nCleanup must NOT be repeated. Current populated dates may be post-cutover entries.\n`);
    }
}

/** One dedicated session; no pool, retry, migration application or generic SQL runner. @returns {Promise<number>} */
export async function runHireDateCli(args, { env = process.env, connect = mysql.createConnection, write = (text) => process.stdout.write(text) } = {}) {
    let connection;
    let ownedRoutine = false;
    let locked = false;
    let lockName;
    let callAttempted = false;
    let sessionError = false;
    let exitCode = 0;
    try {
        const { command, values } = parseCutoverArgs(args);
        if (values.help) { write(`${HELP}\n`); return 0; }
        const config = cutoverDatabaseConfig(env);
        if (values.apply && values["confirm-target"] !== config.target) {
            throw new CutoverError("Database target confirmation mismatch. Run assess and explicitly confirm host:port/database.");
        }
        connection = await connect(config.connection);
        // Prevent idle driver errors from producing unsanitized uncaught output.
        connection.on("error", () => { sessionError = true; });
        await connection.query("SET time_zone = '+00:00'");
        let report = await inspect(connection, config.database);
        printReport(write, config.target, report);
        if (command === "verify") {
            if (report.receipts.length === 0) { write("Status: CUTOVER_NOT_COMPLETED\n"); exitCode = 1; }
            else write(`Status: ${await verifyReceipt(connection, report)}\n`);
        } else if (!values.apply) {
            write(`Status: ${report.receipts.length ? "CUTOVER_ALREADY_COMPLETED" : "READY_FOR_CUTOVER"}\nRead-only; assessment counts are advisory.\n`);
            if (command === "cutover") write("DRY RUN: no cleanup executed. Use --help for all apply gates.\n");
        } else {
            if (report.receipts.length) throw new CutoverError("Cutover already completed. Cleanup must not be repeated.");
            const definition = extractCutoverProcedure(readFileSync(new URL("employee-hire-date-legacy-remediation.sql", import.meta.url), "utf8"));
            lockName = `nhf_hire_date_${createHash("sha256").update(config.database).digest("hex").slice(0, 40)}`;
            const [lock] = await queryRows(connection, "SELECT GET_LOCK(?, 0) AS acquired", [lockName]);
            if (lock.acquired !== 1) throw new CutoverError("Another cutover owns the setup lock. No cleanup attempted.");
            locked = true;
            const routines = await queryRows(connection, `SELECT routine_name FROM information_schema.routines
                WHERE routine_schema = DATABASE() AND routine_name = ?`, [ROUTINE]);
            if (routines.length) throw new CutoverError("Cutover routine already exists; refusing to replace it. Inspect with the DBA before retrying.");
            await connection.query(definition);
            ownedRoutine = true;
            // Fresh counts inside the acknowledged paused-write window, never from a saved dry run.
            report = await inspect(connection, config.database);
            if (report.receipts.length) throw new CutoverError("Cutover receipt appeared; refusing cleanup.");
            await connection.execute(`SET @apply_employee_hire_date_remediation = 1, @employee_writes_paused = 1,
                @operator_email = ?, @verified_backup_reference = ?,
                @expected_employee_count = ?, @expected_clear_count = ?,
                @cutover_deadline_utc = UTC_TIMESTAMP(3) + INTERVAL 30 MINUTE`,
            [values.operator.trim(), values["backup-ref"].trim(), report.counts.employees, report.counts.nonNull]);
            callAttempted = true;
            await connection.query(`CALL ${ROUTINE}()`);
            const completed = await inspect(connection, config.database);
            const status = await verifyReceipt(connection, completed);
            const receipt = completed.receipts[0];
            if (receipt.employeeCount !== report.counts.employees || receipt.clearedCount !== report.counts.nonNull
                || receipt.operatorEmail !== values.operator.trim() || receipt.backupReference !== values["backup-ref"].trim()
                || completed.counts.nonNull !== 0) {
                throw new CutoverError("Post-cutover verification mismatch. Keep writers paused and investigate; do not repeat cleanup.");
            }
            write(`Status: ${status}\nCleanup completed once; receipt and audit evidence validated.\n`);
        }
    } catch (error) {
        exitCode = 1;
        const safeCode = typeof error?.code === "string" && /^[A-Z][A-Z0-9_]{0,63}$/.test(error.code) ? ` (${error.code})` : "";
        const message = error instanceof CutoverError ? error.message : `Database/CLI operation failed${safeCode}. Check connectivity, schema and privileges; credentials and raw errors are suppressed.`;
        write(`Status: VERIFICATION_FAILED\n${message}\n`);
        if (callAttempted) write("CALL was attempted; outcome may already be committed. No automatic retry. Keep writers paused and run verify with a fresh connection.\n");
    } finally {
        if (connection) {
            try {
                // Never drop a routine that this session did not successfully create.
                if (ownedRoutine) await connection.query(`DROP PROCEDURE ${ROUTINE}`);
                if (locked) await connection.query("SELECT RELEASE_LOCK(?)", [lockName]);
            } catch {
                exitCode = 1;
                write("Routine/lock cleanup failed. A DBA must inspect the named routine before another apply.\n");
            } finally {
                try { await connection.end(); }
                catch { exitCode = 1; write("Connection close failed; no automatic retry.\n"); }
                if (sessionError) {
                    exitCode = 1;
                    write("Connection reported an error. No retry; inspect completion with a fresh verify session.\n");
                }
            }
        }
    }
    return exitCode;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
    try {
        // Next's environment precedence, from the repository root, with sanitized logging.
        nextEnv.loadEnvConfig(ROOT, false, { info: () => {}, error: () => {} });
        process.exitCode = await runHireDateCli(process.argv.slice(2));
    } catch {
        process.stderr.write("Failed to load CLI environment. No automatic retry.\n");
        process.exitCode = 1;
    }
}
