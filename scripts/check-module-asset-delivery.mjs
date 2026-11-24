import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline";

const publicOrigin = "https://nhf-preview.example.test";
const files = await readdir(".next/static/media");
const expectedFiles = (await Promise.all(
    ["modules", "menus"].map((folder) => readdir(`public/assets/${folder}`)),
)).flat().filter((file) => file.endsWith(".svg")).sort();
assert.equal(expectedFiles.length, 22, "Expected eleven primary and compact artwork pairs");
assert.equal(new Set(expectedFiles).size, expectedFiles.length, "Artwork filenames must be unique");

const server = spawn(process.execPath, [
    resolve("node_modules/next/dist/bin/next"),
    "start", "--hostname", "127.0.0.1", "--port", "0",
], {
    env: { ...process.env, PUBLIC_APPROVE_URL: publicOrigin },
    stdio: ["ignore", "pipe", "inherit"],
    windowsHide: true,
});
const closed = new Promise((done) => server.once("close", done));
const output = createInterface({ input: server.stdout });
output.on("line", (line) => {
    process.stdout.write(`${line}\n`);
    const origin = line.match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];
    if (origin) output.emit("origin", origin);
});

try {
    const [origin] = await Promise.race([
        once(output, "origin", { signal: AbortSignal.timeout(15_000) }),
        once(server, "exit").then(([code, signal]) => {
            throw new Error(`Next.js exited before startup (${code ?? signal})`);
        }),
    ]);
    const request = (path) => fetch(origin + path, {
        redirect: "manual",
        signal: AbortSignal.timeout(15_000),
    });

    for (const expectedFile of expectedFiles) {
        const name = expectedFile.slice(0, -4);
        const file = files.find((entry) => entry.startsWith(`${name}.`) && entry.endsWith(".svg"));
        assert.ok(file, `Missing built artwork for ${expectedFile}`);
        const response = await request(`/_next/static/media/${file}`);
        assert.equal(response.status, 200, file);
        assert.match(response.headers.get("content-type") ?? "", /^image\/svg\+xml\b/);
        assert.match(await response.text(), /viewBox="0 0 128 128"/);
    }

    const dashboard = await request("/dashboard");
    assert.equal(dashboard.status, 307);
    assert.equal(dashboard.headers.get("location"), `${publicOrigin}/login`);
    process.stdout.write(`All ${expectedFiles.length} production SVGs loaded without an application session. Dashboard still redirects to login.\n`);
} finally {
    if (server.exitCode === null && server.signalCode === null) server.kill();
    const forceStop = setTimeout(() => server.kill("SIGKILL"), 5_000).unref();
    await closed;
    clearTimeout(forceStop);
}
