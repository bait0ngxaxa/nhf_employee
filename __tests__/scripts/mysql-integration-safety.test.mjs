import { describe, expect, it, vi } from "vitest";
import { assertDisposableMysql, validateDisposableTarget } from "../../scripts/mysql-integration-safety.mjs";
import { projectName, runIntegration } from "../../scripts/run-mysql-integration-tests.mjs";

const uuid = "12345678-1234-1234-1234-123456789abc";
const url = `mysql://integration_user:${"a".repeat(48)}@127.0.0.1:43309/employee_nhf_integration`;
const valid = { DATABASE_URL: url, TEST_DATABASE_URL: url, NODE_ENV: "test", NHF_INTEGRATION_SERVER_UUID: uuid };

function harness({ fail, cleanupFail = false, identity = uuid } = {}) {
    const events = [];
    let childEnv;
    const execute = vi.fn((file, args, env) => {
        childEnv = env;
        const operation = file === "docker" ? args[7] : args[0].split(/[\\/]/).at(-1);
        events.push(operation);
        if (operation === fail || (operation === "down" && cleanupFail)) {
            const error = new Error(`Failed ${operation}`);
            error.exitCode = operation === "down" ? 9 : 23;
            throw error;
        }
        if (operation === "port") return "127.0.0.1:43309";
        if (operation === "exec") return uuid;
        return "";
    });
    const end = vi.fn();
    const connect = vi.fn(async () => ({
        query: async () => [[{ db: "employee_nhf_integration", account: "integration_user@%", uuid: identity }]],
        end,
    }));
    return { execute, connect, end, events, capturedEnvironment: () => childEnv };
}

describe("disposable MySQL safety", () => {
    it("accepts only an explicit matching runner target", () => {
        expect(validateDisposableTarget(valid).port).toBe("43309");
    });
    it.each([
        {}, { NODE_ENV: "production" }, { DATABASE_URL: "mysql://production/db_test" },
        { NHF_INTEGRATION_SERVER_UUID: "" },
        ...["mysql://production.example/db_test", url.replace("127.0.0.1", "localhost"),
            url.replace("employee_nhf_integration", "production_test"), `${url}?socket=/tmp/mysql.sock`,
            url.replace("integration_user", "root"), "invalid"].map((target) => ({ DATABASE_URL: target, TEST_DATABASE_URL: target })),
    ])("rejects unsafe/mismatching configuration %j before connecting", async (changes) => {
        const connect = vi.fn();
        const env = Object.keys(changes).length ? { ...valid, ...changes } : {};
        await expect(assertDisposableMysql(env, connect)).rejects.toThrow();
        expect(connect).not.toHaveBeenCalled();
    });
    it("rejects a different live server and closes its connection", async () => {
        const h = harness({ identity: "different-server" });
        await expect(assertDisposableMysql(valid, h.connect)).rejects.toThrow("identity mismatch");
        expect(h.end).toHaveBeenCalledOnce();
    });
    it("rejects externally supplied targets without starting Docker", async () => {
        const h = harness();
        await expect(runIntegration({ env: { TEST_DATABASE_URL: url }, ...h })).rejects.toThrow("External");
        expect(h.execute).not.toHaveBeenCalled();
    });
    it("runs the established commands in order and cleans up after success", async () => {
        const h = harness();
        await runIntegration({ env: { DATABASE_URL: "mysql://production/db" }, ...h });
        expect(h.events).toEqual(["up", "port", "exec", "index.js", "test-routine-reminder-recipient-contract.mjs", "index.js", "vitest.mjs", "down", "ps"]);
        expect(h.capturedEnvironment().DATABASE_URL).toBe(h.capturedEnvironment().TEST_DATABASE_URL);
        expect(h.capturedEnvironment().DATABASE_URL).not.toContain("production");
        expect(h.execute.mock.calls.find(([, args]) => args.includes("deploy"))).toBeDefined();
        expect(h.end).toHaveBeenCalledOnce();
    });
    it.each(["up", "index.js", "test-routine-reminder-recipient-contract.mjs", "vitest.mjs"])("cleans after %s failure and preserves exit code", async (fail) => {
        const h = harness({ fail });
        await expect(runIntegration({ env: {}, ...h })).rejects.toMatchObject({ exitCode: 23 });
        expect(h.events.slice(-2)).toEqual(["down", "ps"]);
    });
    it("does not migrate/test when live identity fails", async () => {
        const h = harness({ identity: "wrong" });
        await expect(runIntegration({ env: {}, ...h })).rejects.toThrow("identity mismatch");
        expect(h.events).toEqual(["up", "port", "exec", "down", "ps"]);
    });
    it("preserves the original failure when cleanup also fails", async () => {
        const h = harness({ fail: "vitest.mjs", cleanupFail: true });
        await expect(runIntegration({ env: {}, ...h })).rejects.toMatchObject({ exitCode: 23 });
    });
    it("fails a successful suite when cleanup fails", async () => {
        const h = harness({ cleanupFail: true });
        await expect(runIntegration({ env: {}, ...h })).rejects.toMatchObject({ exitCode: 9 });
    });
    it("only accepts an intentional failure probe when cleanup succeeds", async () => {
        const h = harness();
        await runIntegration({ env: {}, ...h, probe: true });
        expect(h.events).toEqual(["up", "port", "exec", "down", "ps"]);
        const broken = harness({ cleanupFail: true });
        await expect(runIntegration({ env: {}, ...broken, probe: true })).rejects.toMatchObject({ exitCode: 37 });
    });
    it("uses stable CI project identity and unique local identities", () => {
        expect(projectName({ GITHUB_ACTIONS: "true", GITHUB_RUN_ID: "123", GITHUB_RUN_ATTEMPT: "2" })).toBe("nhf-integration-123-2");
        expect(() => projectName({ GITHUB_ACTIONS: "true" })).toThrow();
        expect(projectName({})).not.toBe(projectName({}));
    });
});
