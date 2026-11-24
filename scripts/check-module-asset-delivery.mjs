import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

const port = "43119";
const origin = `http://127.0.0.1:${port}`;
const publicOrigin = "https://nhf-preview.example.test";
const files = await readdir(".next/static/media");
const server = spawn(process.execPath, [
    resolve("node_modules/next/dist/bin/next"),
    "start", "--hostname", "127.0.0.1", "--port", port,
], {
    env: { ...process.env, PUBLIC_APPROVE_URL: publicOrigin },
    stdio: "inherit",
    windowsHide: true,
});
const closed = once(server, "close");

try {
    const request = (path) => fetch(origin + path, { redirect: "manual" });
    const expectedNames = ["leave", "stock", "routine", "it-ticket"].flatMap((id) => [id, `${id}-compact`]);
    for (let attempt = 0; ; attempt++) {
        try {
            await request("/login");
            break;
        } catch (error) {
            if (attempt >= 20 || server.exitCode !== null) throw error;
            await new Promise((ready) => setTimeout(ready, 250));
        }
    }

    for (const name of expectedNames) {
        const file = files.find((entry) => entry.startsWith(`${name}.`) && entry.endsWith(".svg"));
        assert.ok(file, `Missing built artwork for ${name}`);
        const response = await request(`/_next/static/media/${file}`);
        assert.equal(response.status, 200, file);
        assert.match(response.headers.get("content-type") ?? "", /^image\/svg\+xml\b/);
        assert.match(await response.text(), /viewBox="0 0 128 128"/);
    }

    const dashboard = await request("/dashboard");
    assert.equal(dashboard.status, 307);
    assert.equal(dashboard.headers.get("location"), `${publicOrigin}/login`);
    process.stdout.write("All eight production SVGs loaded without an application session. Dashboard still redirects to login.\n");
} finally {
    if (server.exitCode === null) server.kill();
    await closed;
}
