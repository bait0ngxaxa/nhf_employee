import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";

if (!process.env.TEST_DATABASE_URL && existsSync("integration.env")) {
    process.loadEnvFile("integration.env");
}

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
    throw new Error(
        "ไม่พบ TEST_DATABASE_URL: กำหนดค่า environment หรือคัดลอก integration.env.example เป็น integration.env",
    );
}

const parsedUrl = new URL(testDatabaseUrl);
const databaseName = decodeURIComponent(parsedUrl.pathname.slice(1));
const isDedicatedTestDatabase =
    parsedUrl.protocol === "mysql:"
    && /(?:_integration|_test)$/.test(databaseName);

if (!isDedicatedTestDatabase) {
    throw new Error(
        "TEST_DATABASE_URL ต้องเป็น MySQL และชื่อฐานต้องลงท้ายด้วย _integration หรือ _test เพื่อป้องกันการล้างฐานผิดตัว",
    );
}

const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");
const vitestPackageDirectory = dirname(require.resolve("vitest/package.json"));
const vitestCli = resolve(vitestPackageDirectory, "vitest.mjs");
const writeProgress = (message) => process.stdout.write(`${message}\n`);

const run = (label, cliPath, args) => {
    writeProgress(`\n[integration] ${label}...`);
    const result = spawnSync(process.execPath, [cliPath, ...args], {
        stdio: "inherit",
        env: {
            ...process.env,
            DATABASE_URL: testDatabaseUrl,
            NODE_ENV: "test",
        },
    });
    if (result.error) {
        console.error(
            `[integration] เริ่มคำสั่งไม่สำเร็จ: ${result.error.message}`,
        );
        process.exit(1);
    }
    if (result.status !== 0) {
        console.error(
            `[integration] ${label} ไม่ผ่าน (exit code ${result.status ?? "unknown"})`,
        );
        process.exit(result.status ?? 1);
    }
    writeProgress(`[integration] ${label} สำเร็จ`);
};

writeProgress(
    `[integration] MySQL ${parsedUrl.hostname}:${parsedUrl.port || "3306"}/${databaseName}`,
);
run("ใช้ Prisma migrations", prismaCli, ["migrate", "deploy"]);
run("รัน Vitest", vitestCli, [
    "run",
    "--config",
    "vitest.integration.config.ts",
]);
