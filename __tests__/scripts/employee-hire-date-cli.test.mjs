import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
    cutoverDatabaseConfig, extractCutoverProcedure, parseCutoverArgs, runHireDateCli,
} from "../../scripts/employee-hire-date-cli.mjs";

const env = { DATABASE_URL: "mysql://user:very-secret@localhost:3306/employee_test" };
const apply = ["cutover", "--apply", "--operator=operator@example.org", "--backup-ref=backup-verified",
    "--confirm-writers-paused", "--confirm-target=localhost:3306/employee_test"];
const snapshot = [
    { employeeId: 7, hireDate: "2020-01-01", updatedAt: "2020-01-01 00:00:00.000" },
    { employeeId: 12, hireDate: "2021-07-31", updatedAt: "2020-01-01 00:00:00.000" },
    { employeeId: 25, hireDate: null, updatedAt: "2020-01-01 00:00:00.000" },
];
function receipt() {
    return { id: 1, completedAt: "2026-11-05 00:00:00.000", notFuture: 1,
        operatorEmail: "operator@example.org", backupReference: "backup-verified",
        employeeCount: 3, clearedCount: 2, originalValues: structuredClone(snapshot) };
}
function harness(options = {}) {
    const state = { receipts: options.completed ? [receipt()] : [], nonNull: options.completed ? 0 : 2 };
    let output = "";
    const connection = {
        on: vi.fn(),
        execute: vi.fn((sql, params) => connection.query(sql, params)),
        end: vi.fn(async () => {}),
        query: vi.fn(async (sql, params) => {
            if (sql.includes("SELECT DATABASE()")) return [[{ db: "employee_test", version: "8.0.44" }]];
            if (sql.includes("FROM _prisma_migrations")) return [options.missingMigration ? [] : [
                { migration_name: "20261105090000_employee_hire_date_nullable" },
                { migration_name: "20261105100000_employee_hire_date_cutover_receipt" },
            ]];
            if (sql.includes("information_schema.columns")) return [[{ dataType: "date", nullable: "YES", defaultValue: null }]];
            if (sql.includes("information_schema.tables")) return [[{}, {}, {}]];
            if (sql.includes("COUNT(hireDate)")) return [[{ employees: 3, nonNull: state.nonNull }]];
            if (sql.includes("FROM employee_hire_date_cutover")) return [state.receipts];
            if (sql.includes("FROM audit_logs")) return [state.receipts.length ? snapshot.filter((s) => s.hireDate).map((s) => ({
                entityId: s.employeeId, userEmail: "operator@example.org", createdAt: "2026-11-05 00:00:00.000",
                details: JSON.stringify({ before: { hireDate: s.hireDate }, after: { hireDate: null }, metadata: {
                    reason: "legacy_hire_date_cutover", cutoverId: 1, backupReference: "backup-verified", databaseActor: "test@localhost",
                } }),
            })) : []];
            if (sql.includes("GET_LOCK")) return [[{ acquired: options.busy ? 0 : 1 }]];
            if (sql.includes("information_schema.routines")) return [options.existingRoutine ? [{ routine_name: "existing" }] : []];
            if (sql.startsWith("CALL")) {
                if (options.callError) throw options.callError;
                state.receipts = [receipt()]; state.nonNull = 0;
                if (options.lostCommitReply) throw Object.assign(new Error("lost acknowledgment"), { code: "PROTOCOL_CONNECTION_LOST" });
            }
            if (sql.startsWith("SET @")) expect(params).toEqual(["operator@example.org", "backup-verified", 3, 2]);
            return [[]];
        }),
    };
    const connect = vi.fn(async () => {
        if (options.connectError) throw options.connectError;
        return connection;
    });
    return { state, connection, connect, output: () => output,
        run: (args) => runHireDateCli(args, { env, connect, write: (text) => { output += text; } }) };
}
function recordMutations(h) {
    return h.connection.query.mock.calls.filter(([sql]) => /^(?:CREATE|DROP|CALL|UPDATE|INSERT|DELETE)/.test(sql));
}

describe("hire date CLI configuration and SQL artifact", () => {
    it.each([
        ["cutover", "--force"], ["assess", "--apply"], ["verify", "--operator=x"],
        ["cutover", "--apply=false"], ["cutover", "--apply", "--apply"],
        ["cutover", "--operator"], ["unknown"], ["assess", "positional"],
    ])("rejects unsupported/malformed arguments: %j", (...args) => {
        expect(() => parseCutoverArgs(args)).toThrow();
    });
    it("loads only the known procedure and rejects changed wrapper boundaries", () => {
        const sql = readFileSync(new URL("../../scripts/employee-hire-date-legacy-remediation.sql", import.meta.url), "utf8");
        const definition = extractCutoverProcedure(sql);
        expect(definition).toMatch(/^CREATE PROCEDURE clear_legacy_employee_hire_dates\(\)/);
        expect(definition).toContain("ROLLBACK;");
        expect(definition).toContain("COMMIT;");
        expect(definition).not.toContain("DELIMITER");
        expect(() => extractCutoverProcedure(sql + "\nDROP TABLE employees;")).toThrow();
        expect(() => extractCutoverProcedure(sql.replace("END$$", "END;"))).toThrow();
        expect(extractCutoverProcedure(sql.replace(/\r?\n/g, "\r\n"))).toBe(definition);
    });
    it.each(["--operator=", "--operator=   ", `--operator=${"x".repeat(192)}`])("rejects blank/oversized operator: %s", (flag) => {
        expect(() => parseCutoverArgs(apply.map((arg) => arg.startsWith("--operator=") ? flag : arg))).toThrow();
    });
    it("shows help without reading database configuration or connecting", async () => {
        const connect = vi.fn();
        expect(await runHireDateCli(["cutover", "--help"], { env: {}, connect, write: vi.fn() })).toBe(0);
        expect(connect).not.toHaveBeenCalled();
    });
    it("sanitizes the target and never falls back from a specified dedicated URL", () => {
        expect(cutoverDatabaseConfig(env).target).toBe("localhost:3306/employee_test");
        expect(() => cutoverDatabaseConfig({ ...env, EMPLOYEE_HIRE_DATE_DATABASE_URL: "" })).toThrow();
        const config = cutoverDatabaseConfig({ ...env, EMPLOYEE_HIRE_DATE_DATABASE_URL: "mysql://admin:other-secret@db:3307/production" });
        expect(config.target).toBe("db:3307/production");
        expect(config.connection.multipleStatements).toBe(false);
        expect(() => cutoverDatabaseConfig({ DATABASE_URL: `${env.DATABASE_URL}?multipleStatements=true` })).toThrow();
        expect(() => cutoverDatabaseConfig({ DATABASE_URL: `${env.DATABASE_URL}?sslaccept=accept_invalid_certs` })).toThrow();
        expect(cutoverDatabaseConfig({ DATABASE_URL: `${env.DATABASE_URL}?sslaccept=strict` }).connection.ssl).toEqual({ rejectUnauthorized: true, verifyIdentity: true });
        expect(() => cutoverDatabaseConfig({ DATABASE_URL: `${env.DATABASE_URL}?sslidentity=client.p12` })).toThrow();
    });
});

describe("assess", () => {
    it("is read-only and reports accurate counts and sanitized target", async () => {
        const h = harness();
        expect(await h.run(["assess"])).toBe(0);
        expect(h.output()).toContain("Total employees: 3");
        expect(h.output()).toContain("Non-null hire dates: 2");
        expect(h.output()).toContain("Already NULL: 1");
        expect(h.output()).toContain("localhost:3306/employee_test");
        expect(h.output()).not.toContain("very-secret");
        expect(recordMutations(h)).toEqual([]);
        expect(h.connection.end).toHaveBeenCalledOnce();
    });
    it("reports an existing receipt without ever repeating cleanup", async () => {
        const h = harness({ completed: true });
        h.state.receipts[0].backupReference = "mysql://user:stored-secret@localhost/database";
        expect(await h.run(["assess"])).toBe(0);
        expect(h.output()).toContain("Cleanup must NOT be repeated");
        expect(h.output()).not.toContain("stored-secret");
        expect(h.output()).not.toContain("mysql://");
        expect(recordMutations(h)).toEqual([]);
    });
    it("refuses a missing migration", async () => {
        const h = harness({ missingMigration: true });
        expect(await h.run(["assess"])).toBe(1);
        expect(h.output()).toContain("migrations are missing");
        expect(recordMutations(h)).toEqual([]);
    });
    it("fails nonzero without leaking connection errors or credentials", async () => {
        const h = harness({ connectError: new Error(`Cannot connect: ${env.DATABASE_URL}`) });
        expect(await h.run(["assess"])).toBe(1);
        expect(h.output()).not.toContain("very-secret");
        expect(h.output()).not.toContain("mysql://");
    });
});

describe("cutover", () => {
    it.each([["cutover"], apply.filter((arg) => arg !== "--apply")])("is read-only without --apply: %j", async (...args) => {
        const h = harness();
        expect(await h.run(args)).toBe(0);
        expect(recordMutations(h)).toEqual([]);
        expect(h.output()).toContain("DRY RUN");
    });
    it.each(["--operator=operator@example.org", "--backup-ref=backup-verified", "--confirm-writers-paused", "--confirm-target=localhost:3306/employee_test"])("requires %s before connecting", async (missing) => {
        const h = harness();
        expect(await h.run(apply.filter((arg) => arg !== missing))).toBe(1);
        expect(h.connect).not.toHaveBeenCalled();
    });
    it("rejects a mismatched target without connecting", async () => {
        const h = harness();
        expect(await h.run([...apply.slice(0, -1), "--confirm-target=other:3306/production"])).toBe(1);
        expect(h.connect).not.toHaveBeenCalled();
    });
    it("refuses a completed receipt before routine installation", async () => {
        const h = harness({ completed: true });
        expect(await h.run(apply)).toBe(1);
        expect(recordMutations(h)).toEqual([]);
    });
    it.each([{ existingRoutine: true }, { busy: true }])("refuses an unexpected routine or concurrent setup: %j", async (options) => {
        const h = harness(options);
        expect(await h.run(apply)).toBe(1);
        expect(recordMutations(h)).toEqual([]);
    });
    it("uses one session, fresh counts, one authoritative CALL and cleans up its routine", async () => {
        const h = harness();
        expect(await h.run(apply)).toBe(0);
        expect(h.connect).toHaveBeenCalledOnce();
        const mutations = recordMutations(h).map(([sql]) => sql);
        expect(mutations).toHaveLength(3);
        expect(mutations[0]).toMatch(/^CREATE PROCEDURE/);
        expect(mutations[1]).toBe("CALL clear_legacy_employee_hire_dates()");
        expect(mutations[2]).toBe("DROP PROCEDURE clear_legacy_employee_hire_dates");
        expect(h.state.receipts).toHaveLength(1);
        expect(h.output()).toContain("CUTOVER_VERIFIED");
    });
    it.each([new Error("forced procedure rollback"), Object.assign(new Error("secret DB URL"), { code: "PROTOCOL_CONNECTION_LOST" })])("never retries a failed or ambiguous CALL", async (callError) => {
        const h = harness({ callError });
        expect(await h.run(apply)).toBe(1);
        expect(h.connect).toHaveBeenCalledOnce();
        expect(h.connection.query.mock.calls.filter(([sql]) => sql.startsWith("CALL"))).toHaveLength(1);
        expect(h.state.receipts).toEqual([]);
        expect(h.state.nonNull).toBe(2);
        expect(h.output()).toContain("No automatic retry");
        expect(h.output()).not.toContain("secret DB URL");
    });
    it("does not retry when a commit succeeds but the CALL acknowledgment is lost", async () => {
        const h = harness({ lostCommitReply: true });
        expect(await h.run(apply)).toBe(1);
        expect(h.state.receipts).toHaveLength(1);
        expect(h.connection.query.mock.calls.filter(([sql]) => sql.startsWith("CALL"))).toHaveLength(1);
        expect(h.output()).toContain("outcome may already be committed");
        expect(await h.run(["verify"])).toBe(0);
        h.state.nonNull = 1;
        expect(await h.run(apply)).toBe(1);
        expect(h.state.nonNull).toBe(1);
        expect(h.connection.query.mock.calls.filter(([sql]) => sql.startsWith("CALL"))).toHaveLength(1);
    });
});

describe("verify", () => {
    it("reports missing receipt nonzero without writes", async () => {
        const h = harness();
        expect(await h.run(["verify"])).toBe(1);
        expect(h.output()).toContain("CUTOVER_NOT_COMPLETED");
        expect(recordMutations(h)).toEqual([]);
    });
    it.each([0, 1])("accepts a completed cutover with %s newly populated dates", async (nonNull) => {
        const h = harness({ completed: true });
        h.state.nonNull = nonNull;
        expect(await h.run(["verify"])).toBe(0);
        expect(h.output()).toContain(nonNull ? "CUTOVER_VERIFIED_WITH_NEW_DATES" : "CUTOVER_VERIFIED");
        expect(recordMutations(h)).toEqual([]);
    });
    it.each([
        (r) => { r.clearedCount = 4; },
        (r) => { r.employeeCount = 4; },
        (r) => { r.originalValues[1].employeeId = 7; },
        (r) => { r.originalValues[0].hireDate = "2020-02-30"; },
        (r) => { r.operatorEmail = "wrong@example.org"; },
        (r) => { r.notFuture = 0; },
    ])("rejects invalid or inconsistent receipt/audit evidence", async (corrupt) => {
        const h = harness({ completed: true });
        corrupt(h.state.receipts[0]);
        expect(await h.run(["verify"])).toBe(1);
        expect(h.output()).toContain("VERIFICATION_FAILED");
        expect(recordMutations(h)).toEqual([]);
    });
});
