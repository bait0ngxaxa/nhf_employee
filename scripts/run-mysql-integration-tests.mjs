import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { stripVTControlCharacters } from "node:util";
import { createConnection } from "mysql2/promise";
import { assertDisposableMysql } from "./mysql-integration-safety.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const write = (message) => process.stdout.write(`[integration] ${message}\n`);

class IntentionalCleanupProbeError extends Error {
    constructor() {
        super("Intentional failure to verify disposable cleanup");
        this.exitCode = 37;
    }
}

function safeDiagnostics(output, env) {
    const sensitiveKey = /pass(?:word|wd)?|pwd|token|secret|credential|(?:api|private|access)[_-]?key|(?:database|connection).*url/i;
    let text = stripVTControlCharacters(output);
    // Replace effective child secrets (including encoded forms) before formatting/truncating.
    const secrets = Object.entries(env).filter(([key, value]) => typeof value === "string" && value &&
        (sensitiveKey.test(key) || value.includes("://")))
        .flatMap(([, value]) => {
            try {
                const url = new URL(value);
                return [value, url.password, decodeURIComponent(url.password),
                    ...Array.from(url.searchParams).filter(([key]) => sensitiveKey.test(key)).map(([, secret]) => secret)];
            } catch { return [value]; }
        })
        .flatMap((value) => [value, encodeURIComponent(value), JSON.stringify(value).slice(1, -1), stripVTControlCharacters(value)])
        .filter(Boolean).sort((a, b) => b.length - a.length);
    for (const secret of secrets) text = text.replaceAll(secret, "[REDACTED]");
    text = text
        .replace(/-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/g, "[REDACTED]")
        // Redact whole URLs, including credentials unknown to the child environment.
        .replace(/[a-z][a-z0-9+.-]*:\/\/[^\s"'<>]+/gi, "[REDACTED]")
        .replace(/\b(Bearer|Basic)\s+[^\s"'<>]+/gi, "$1 [REDACTED]")
        .replace(/(["']?[\w.-]*(?:pass(?:word|wd)?|pwd|token|secret|credential|(?:api|private|access)[_-]?key|database_url|connection_url)[\w.-]*["']?\s*[:=]\s*)("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^\s,;}]+)/gi,
            "$1[REDACTED]")
        .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, "");
    return text.trim().split("\n").slice(0, 12).join("\n").slice(0, 2400);
}

function command(file, args, env, capture = false) {
    const result = spawnSync(file, args, {
        cwd: root, env, encoding: "utf8", stdio: capture ? "pipe" : "inherit",
    });
    if (result.error || result.status !== 0) {
        const operation = file === "docker" && args[0] === "compose" && ["up", "port", "exec", "down", "ps"].includes(args[7]) ? args[7] : undefined;
        const label = operation ? `Docker Compose ${operation}` : "Integration command";
        const detail = capture ? safeDiagnostics(`${result.stdout ?? ""}\n${result.stderr ?? ""}`, env) : "";
        const reason = /^[A-Z0-9_]+$/.test(result.error?.code ?? "") ? `, ${result.error.code}` : "";
        // Never print arguments, raw environment or spawn error messages (which can include arguments).
        const error = new Error(`${label} failed (exit ${result.status ?? "unknown"}${reason})${detail ? `\n${detail}` : ""}`);
        error.exitCode = result.status ?? 1;
        throw error;
    }
    return result.stdout?.trim() ?? "";
}

export function projectName(env) {
    if (env.GITHUB_ACTIONS === "true") {
        if (!/^\d+$/.test(env.GITHUB_RUN_ID ?? "") || !/^\d+$/.test(env.GITHUB_RUN_ATTEMPT ?? "")) {
            throw new Error("Missing valid GitHub run identity");
        }
        return `nhf-integration-${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT}`;
    }
    return `nhf-integration-${randomBytes(8).toString("hex")}`;
}

// Injectable process/database boundaries permit safety tests without Docker.
export async function runIntegration({ env = process.env, execute = command, connect = createConnection, probe = false, cleanupOnly = false } = {}) {
    if (!cleanupOnly && env.TEST_DATABASE_URL) {
        throw new Error("External TEST_DATABASE_URL is not accepted; this runner owns a disposable Compose database");
    }
    const project = projectName(env) + (probe ? "-probe" : "");
    const password = randomBytes(24).toString("hex");
    const childEnv = {
        ...env,
        MYSQL_INTEGRATION_ROOT_PASSWORD: randomBytes(24).toString("hex"),
        MYSQL_INTEGRATION_DATABASE: "employee_nhf_integration",
        MYSQL_INTEGRATION_USER: "integration_user",
        MYSQL_INTEGRATION_PASSWORD: password,
        MYSQL_INTEGRATION_PORT: "0",
        NODE_ENV: "test",
    };
    const compose = (...args) => execute("docker", [
        "compose", "--env-file", resolve(root, "integration.env.example"),
        "-f", resolve(root, "docker-compose.integration.yml"), "-p", project, ...args,
    ], childEnv, true);
    const down = () => {
        compose("down", "--volumes", "--remove-orphans");
        if (compose("ps", "--all", "--quiet")) throw new Error("Disposable containers remain after cleanup");
        write(`Cleanup verified: ${project}`);
    };
    if (cleanupOnly) { down(); return; }

    let failure;
    let cleanupFailure;
    try {
        write(`Starting disposable MySQL: ${project}`);
        compose("up", "--detach", "--wait", "--wait-timeout", "120");
        const endpoint = compose("port", "mysql-integration", "3306");
        if (!/^127\.0\.0\.1:\d+$/.test(endpoint)) throw new Error("Unexpected disposable MySQL binding");
        const uuid = compose("exec", "-T", "-e", `MYSQL_PWD=${childEnv.MYSQL_INTEGRATION_ROOT_PASSWORD}`,
            "mysql-integration", "mysql", "-uroot", "--batch", "--skip-column-names", "-e", "SELECT @@server_uuid");
        childEnv.DATABASE_URL = `mysql://integration_user:${password}@${endpoint}/employee_nhf_integration`;
        childEnv.TEST_DATABASE_URL = childEnv.DATABASE_URL;
        childEnv.NHF_INTEGRATION_SERVER_UUID = uuid;
        await assertDisposableMysql(childEnv, connect);
        write("Disposable database identity verified before migrations/tests");
        if (probe) throw new IntentionalCleanupProbeError();
        const run = (label, cli, args) => {
            write(`${label}...`);
            execute(process.execPath, [cli, ...args], childEnv);
            write(`${label} สำเร็จ`);
        };
        run("Generate Prisma Client", require.resolve("prisma/build/index.js"), ["generate"]);
        run("Routine recipient migration SQL coverage", resolve(root, "scripts/test-routine-reminder-recipient-contract.mjs"), []);
        run("ใช้ Prisma migrations", require.resolve("prisma/build/index.js"), ["migrate", "deploy"]);
        run("รัน Vitest", resolve(dirname(require.resolve("vitest/package.json")), "vitest.mjs"), ["run", "--config", "vitest.integration.config.ts"]);
    } catch (error) {
        failure = error;
    } finally {
        try { down(); } catch (error) { cleanupFailure = error; }
    }
    if (cleanupFailure) console.error(`[integration] Disposable cleanup failed: ${safeDiagnostics(cleanupFailure.message, childEnv)}`);
    if (failure) {
        if (probe && failure instanceof IntentionalCleanupProbeError && !cleanupFailure) {
            write("Intentional exit 37 observed; cleanup after failure verified");
            return;
        }
        throw failure;
    }
    if (cleanupFailure) throw cleanupFailure;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const mode = process.argv.slice(2);
        if (mode.length > 1 || (mode.length && !["--cleanup", "--verify-failure-cleanup"].includes(mode[0]))) {
            throw new Error("Unsupported integration runner arguments");
        }
        if (mode[0] === "--cleanup") {
            if (process.env.GITHUB_ACTIONS !== "true") throw new Error("Standalone cleanup requires GitHub run identity; local runs clean up in finally");
            for (const probe of [false, true]) await runIntegration({ cleanupOnly: true, probe });
        } else {
            await runIntegration({ probe: mode[0] === "--verify-failure-cleanup" });
        }
    } catch (error) {
        console.error(`[integration] ${error.message}`);
        process.exitCode = error.exitCode || 1;
    }
}
