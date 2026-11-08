import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertDisposableMysql, validateDisposableTarget } from "../../scripts/mysql-integration-safety.mjs";
import { projectName, runIntegration } from "../../scripts/run-mysql-integration-tests.mjs";

const uuid = "12345678-1234-1234-1234-123456789abc";
const url = `mysql://integration_user:${"a".repeat(48)}@127.0.0.1:43309/employee_nhf_integration`;
const valid = { DATABASE_URL: url, TEST_DATABASE_URL: url, NODE_ENV: "test", NHF_INTEGRATION_SERVER_UUID: uuid };

vi.mock("node:child_process", () => ({ spawnSync: vi.fn() }));
afterEach(() => vi.restoreAllMocks());

function harness({ fail, cleanupFail = false, identity = uuid, exitCode = 23 } = {}) {
    const events = [];
    let childEnv;
    const execute = vi.fn((file, args, env) => {
        childEnv = env;
        const operation = file === "docker" ? args[7] : args[0].split(/[\\/]/).at(-1);
        events.push(operation);
        if (operation === fail || (operation === "down" && cleanupFail)) {
            const error = new Error(`Failed ${operation}`);
            error.exitCode = operation === "down" ? 9 : exitCode;
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
    it.each(["up", "port", "exec"])("rejects unexpected %s exit 37 during the failure probe", async (fail) => {
        const h = harness({ fail, exitCode: 37 });
        await expect(runIntegration({ env: {}, ...h, probe: true })).rejects.toMatchObject({ message: `Failed ${fail}`, exitCode: 37 });
        expect(h.events.slice(-2)).toEqual(["down", "ps"]);
    });
    it("uses stable CI project identity and unique local identities", () => {
        expect(projectName({ GITHUB_ACTIONS: "true", GITHUB_RUN_ID: "123", GITHUB_RUN_ATTEMPT: "2" })).toBe("nhf-integration-123-2");
        expect(() => projectName({ GITHUB_ACTIONS: "true" })).toThrow();
        expect(projectName({})).not.toBe(projectName({}));
    });
});

describe("Docker failure diagnostics", () => {
    function dockerFailure(operation, { stdout = "", stderr = "", env = {}, cleanupFails = false } = {}) {
        vi.mocked(spawnSync).mockImplementation((_file, args) => {
            const stage = args[7];
            if (stage === operation || (stage === "down" && cleanupFails)) return { status: stage === operation ? 37 : 9, stdout, stderr };
            return { status: 0, stdout: stage === "port" ? "127.0.0.1:43309" : stage === "exec" ? uuid : "", stderr: "" };
        });
        return runIntegration({ env, connect: harness().connect, probe: true });
    }

    it.each(["up", "port", "exec", "down", "ps"])("reports %s and preserves exit status with useful diagnostics", async (operation) => {
        // down/ps fail after an intentional probe error, so use cleanup-only mode for those stages.
        const pending = dockerFailure(operation, { stderr: "Cannot connect to the Docker daemon" });
        if (["down", "ps"].includes(operation)) {
            await expect(pending).rejects.toMatchObject({ exitCode: 37, message: "Intentional failure to verify disposable cleanup" });
            await expect(runIntegration({ env: {}, cleanupOnly: true })).rejects.toMatchObject({
                exitCode: 37, message: `Docker Compose ${operation} failed (exit 37)\nCannot connect to the Docker daemon`,
            });
        } else {
            await expect(pending).rejects.toMatchObject({
                exitCode: 37, message: `Docker Compose ${operation} failed (exit 37)\nCannot connect to the Docker daemon`,
            });
        }
    });
    it("redacts environment secrets and unknown credential assignments/URLs in both streams", async () => {
        const env = { MYSQL_PASSWORD: "env-pass-123", LINE_ACCESS_TOKEN: "env-token-123", PRIVATE_SECRET: "env-secret-123", DATABASE_URL: "mysql://prod:env-db-pass@prod/db" };
        const stdout = 'image pull failed env-pass-123 env-token-123 env-secret-123 env-db-pass mysql://prod:env-db-pass@prod/db\nMYSQL_PWD=unknown-password DATABASE_URL="mysql://user:unknown-url-pass@host/db"';
        const stderr = 'connection refused mysql://user:other-pass@host/db\nAPI_TOKEN="unknown token with spaces" {"client_secret":"unknown-json-secret"}\nAuthorization: Bearer unknown-bearer';
        const error = await dockerFailure("up", { env, stdout, stderr }).catch((failure) => failure);
        expect(error.exitCode).toBe(37);
        expect(error.message).toContain("image pull failed");
        expect(error.message).toContain("connection refused");
        expect(error.message).toContain("[REDACTED]");
        for (const secret of [...Object.values(env), "env-db-pass", "unknown-password", "unknown-url-pass", "other-pass", "unknown token with spaces", "unknown-json-secret", "unknown-bearer"]) {
            expect(error.message).not.toContain(secret);
        }
    });
    it("redacts generated child credentials without printing command arguments", async () => {
        vi.mocked(spawnSync).mockImplementation((_file, args, options) => ({
            status: args[7] === "up" ? 37 : 0,
            stdout: args[7] === "up" ? `network failed ${options.env.MYSQL_INTEGRATION_PASSWORD}` : "",
            stderr: args[7] === "up" ? `health failed ${options.env.MYSQL_INTEGRATION_ROOT_PASSWORD}` : "",
        }));
        const error = await runIntegration({ env: {} }).catch((failure) => failure);
        expect(error.message).toContain("network failed [REDACTED]");
        expect(error.message).toContain("health failed [REDACTED]");
        expect(error.message).not.toContain("--env-file");
        expect(error.message).not.toMatch(/[a-f0-9]{48}/);
    });
    it("bounds diagnostics by lines and total characters", async () => {
        const error = await dockerFailure("up", { stderr: Array.from({ length: 30 }, (_, i) => `line-${i} ${"x".repeat(500)}`).join("\n") }).catch((failure) => failure);
        expect(error.message.length).toBeLessThanOrEqual(2500);
        expect(error.message.split("\n").length).toBeLessThanOrEqual(13);
        expect(error.message).not.toContain("line-12");
    });
    it("redacts escaped quoted assignments, encoded secrets and terminal escapes", async () => {
        const env = { SMTP_PASS: "mail secret/value" };
        const error = await dockerFailure("up", {
            env,
            stdout: `pull failed ${encodeURIComponent(env.SMTP_PASS)}\nMYSQL_PWD="escaped\\\"secret"\nPRIVATE_KEY='multi\nline secret'`,
            stderr: "\u001b[31mhealth failed\u001b[0m Authorization: Basic unknown-basic",
        }).catch((failure) => failure);
        expect(error.message).toContain("pull failed [REDACTED]");
        expect(error.message).toContain("health failed");
        expect(error.message).not.toMatch(/escaped|secret|unknown-basic|\u001b/);
    });
    it("reports spawn failure codes without exposing the spawn error arguments", async () => {
        vi.mocked(spawnSync).mockImplementation((_file, args) => args[7] === "up"
            ? { status: null, error: Object.assign(new Error("spawn with secret arguments"), { code: "ENOENT" }) }
            : { status: 0, stdout: "", stderr: "" });
        await expect(runIntegration({ env: {} })).rejects.toMatchObject({ exitCode: 1, message: "Docker Compose up failed (exit unknown, ENOENT)" });
    });
    it("keeps original diagnostics and status when cleanup also fails", async () => {
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        await expect(dockerFailure("up", { stderr: "daemon unavailable MYSQL_PWD=hidden", cleanupFails: true })).rejects.toMatchObject({
            exitCode: 37, message: expect.stringContaining("Docker Compose up failed (exit 37)"),
        });
        expect(log).toHaveBeenCalledWith(expect.stringContaining("Docker Compose down failed (exit 9)"));
        expect(log.mock.calls.flat().join(" ")).not.toContain("hidden");
    });
});
