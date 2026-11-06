import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import ExcelJS from "exceljs";

// Run after a successful production build. Uses only a dedicated integration DB.
if (!process.env.TEST_DATABASE_URL) process.loadEnvFile("integration.env");
const databaseUrl = new URL(process.env.TEST_DATABASE_URL || "invalid:");
assert.ok(databaseUrl.protocol === "mysql:" && /(?:_integration|_test)$/.test(databaseUrl.pathname), "Dedicated MySQL test database required");
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl.href } } });
const { default: puppeteer } = await import(process.env.STOCK_BROWSER_DRIVER || "puppeteer");
const output = await mkdtemp(join(tmpdir(), "nhf-stock-live-"));
const port = process.env.STOCK_TEST_PORT || "3137";
const base = `http://localhost:${port}`;
const suffix = randomBytes(6).toString("hex");
const email = `stock-browser-${suffix}@integration.test`;
const password = randomBytes(24).toString("hex");
let browser;
let server;
let serverLog = "";
try {
    const user = await prisma.user.create({ data: { email, name: "ผู้ทดสอบ Stock Analytics", password: await bcrypt.hash(password, 10), role: "USER" } });
    const department = await prisma.department.create({ data: { name: `Stock browser ${suffix}`, code: `SB-${suffix}` } });
    await prisma.employee.create({ data: { firstName: "ผู้ทดสอบ", lastName: "สต็อก", email, position: "ทดสอบ", departmentId: department.id, user: { connect: { id: user.id } } } });
    await prisma.userCapabilityGrant.createMany({ data: ["stock.report.read", "stock.report.export"].map((capabilityKey) => ({ userId: user.id, capabilityKey, scope: "ALL" })) });
    const category = await prisma.stockCategory.create({ data: { name: `ทดสอบ browser ${suffix}` } });
    const item = await prisma.stockItem.create({ data: { name: "กระดาษทดสอบ Browser", sku: `B-${suffix}`, unit: "รีม", categoryId: category.id } });
    const variant = await prisma.stockItemVariant.create({ data: { stockItemId: item.id, sku: `BV-${suffix}`, unit: "รีม", quantity: 10, minStock: 2 } });
    await prisma.stockItem.update({ where: { id: item.id }, data: { defaultVariantId: variant.id } });
    const projectCode = `BROWSER-${suffix}`;
    await prisma.stockRequest.create({ data: { requestedBy: user.id, idempotencyKey: suffix, requestHash: "0".repeat(64), projectCode, status: "ISSUED", issuedAt: new Date(), issuedById: user.id, items: { create: { itemId: item.id, variantId: variant.id, quantity: 4 } } } });
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", port], { env: { ...process.env, DATABASE_URL: databaseUrl.href }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    const recordLog = (chunk) => { serverLog = (serverLog + String(chunk)).slice(-6000); };
    server.stdout.on("data", recordLog);
    server.stderr.on("data", recordLog);
    await new Promise((done, reject) => {
        const deadline = Date.now() + 30000;
        const check = async () => {
            if (server.exitCode !== null) return reject(new Error("Production server exited"));
            try { if ((await fetch(`${base}/login`)).ok) return done(); } catch { /* wait for listener */ }
            if (Date.now() > deadline) return reject(new Error("Production server startup timeout"));
            setTimeout(check, 300);
        };
        void check();
    });
    assert.equal((await fetch(`${base}/api/stock/reports/analytics`)).status, 401);
    browser = await puppeteer.launch({ headless: true, executablePath: process.env.CHART_BROWSER_PATH || undefined });
    const page = await browser.newPage();
    page.setDefaultTimeout(15000);
    await page.setViewport({ width: 1280, height: 1000 });
    await page.goto(`${base}/login`);
    const loginStatus = await page.evaluate(async ({ email, password }) => (await fetch("/api/auth/hybrid-login", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ email, password }) })).status, { email, password });
    assert.equal(loginStatus, 200, "real login must succeed");
    const response = await page.goto(`${base}/dashboard/stock?stockTab=reports`);
    assert.equal(response.status(), 200);
    await page.waitForSelector(".recharts-bar-rectangle");
    assert.ok((await page.$eval('[role="tab"][data-state="active"]', (node) => node.textContent)).includes("รายงาน"));
    const analytics = await page.evaluate(async (projectCode) => (await fetch(`/api/stock/reports/analytics?projectCode=${encodeURIComponent(projectCode)}`)).json(), projectCode);
    assert.equal(analytics.kpis.issuedRequests, 1);
    assert.equal(analytics.kpis.issuedLines, 1);
    assert.equal(analytics.topMaterials[0].id, item.id);
    assert.deepEqual(analytics.topMaterials[0].quantities, [{ unit: "รีม", quantity: 4 }]);
    await page.screenshot({ path: join(output, "desktop.png"), fullPage: true });
    await page.setViewport({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: join(output, "mobile.png"), fullPage: true });
    const rawBytes = await page.evaluate(async (projectCode) => Array.from(new Uint8Array(await (await fetch(`/api/stock/reports/export?reportType=raw-issued&projectCode=${encodeURIComponent(projectCode)}`)).arrayBuffer())), projectCode);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(rawBytes));
    assert.equal(workbook.worksheets[0].actualRowCount, 2);
    assert.equal(workbook.worksheets[0].getCell("M2").value, 4);
    await prisma.userCapabilityGrant.deleteMany({ where: { userId: user.id, capabilityKey: "stock.report.read" } });
    assert.equal(await page.evaluate(async () => (await fetch("/api/stock/reports/analytics")).status), 403, "revoked read cannot be inferred from export");
    assert.equal(await page.evaluate(async () => (await fetch("/api/stock/reports/export?reportType=raw-inventory")).status), 200, "export-only authority is preserved");
    await prisma.userCapabilityGrant.deleteMany({ where: { userId: user.id, capabilityKey: "stock.report.export" } });
    assert.equal(await page.evaluate(async () => (await fetch("/api/stock/reports/export?reportType=raw-issued")).status), 403);
    process.stdout.write(`Stock live production browser passed: login, Dashboard -> API -> MySQL, raw XLSX reconciliation, mobile layout, anonymous and revoked permissions. Captures: ${output}\n`);
} catch (error) {
    // Report bounded server diagnostics only; never print test credentials or tokens.
    console.error(serverLog);
    throw error;
} finally {
    await browser?.close();
    server?.kill();
    await prisma.$disconnect();
}
