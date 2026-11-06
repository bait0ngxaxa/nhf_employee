import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
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
const base = `http://stock-browser.localhost:${port}`;
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
    await prisma.userCapabilityGrant.createMany({ data: ["stock.report.read", "stock.report.export", "stock.catalog.read", "stock.inventory.manage"].map((capabilityKey) => ({ userId: user.id, capabilityKey, scope: "ALL" })) });
    const category = await prisma.stockCategory.create({ data: { name: `ทดสอบ browser ${suffix}` } });
    const item = await prisma.stockItem.create({ data: { name: `กระดาษทดสอบ Browser ${suffix}`, sku: `B-${suffix}`, unit: "รีม", categoryId: category.id } });
    const variant = await prisma.stockItemVariant.create({ data: { stockItemId: item.id, sku: `BV-${suffix}`, unit: "รีม", quantity: 10, minStock: 12 } });
    await prisma.stockItem.update({ where: { id: item.id }, data: { defaultVariantId: variant.id } });
    const projectCode = `BROWSER-${suffix}`;
    await prisma.stockRequest.create({ data: { requestedBy: user.id, idempotencyKey: suffix, requestHash: "0".repeat(64), projectCode, status: "ISSUED", issuedAt: new Date(), issuedById: user.id, items: { create: { itemId: item.id, variantId: variant.id, quantity: 4 } } } });
    await prisma.stockRequest.create({ data: { requestedBy: user.id, idempotencyKey: `${suffix}-pending`, requestHash: "0".repeat(64), projectCode, status: "PENDING_ISSUE", items: { create: { itemId: item.id, variantId: variant.id, quantity: 3 } } } });
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", port], { env: { ...process.env, DATABASE_URL: databaseUrl.href, NODE_ENV: "production", PUBLIC_APPROVE_URL: base }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    const recordLog = (chunk) => { serverLog = (serverLog + String(chunk)).slice(-6000); };
    server.stdout.on("data", recordLog);
    server.stderr.on("data", recordLog);
    await new Promise((done, reject) => {
        const deadline = Date.now() + 30000;
        const check = async () => {
            if (server.exitCode !== null) return reject(new Error("Production server exited"));
            try { if ((await fetch(`http://127.0.0.1:${port}/login`)).ok) return done(); } catch { /* wait for listener */ }
            if (Date.now() > deadline) return reject(new Error("Production server startup timeout"));
            setTimeout(check, 300);
        };
        void check();
    });
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/stock/reports/analytics`)).status, 401);
    browser = await puppeteer.launch({ headless: true, executablePath: process.env.CHART_BROWSER_PATH || undefined });
    const downloads = [];
    const downloadNames = new Map();
    const cdp = await browser.target().createCDPSession();
    await cdp.send('Browser.setDownloadBehavior', { behavior: 'allowAndName', downloadPath: output, eventsEnabled: true });
    cdp.on('Browser.downloadWillBegin', (event) => downloadNames.set(event.guid, event.suggestedFilename));
    cdp.on('Browser.downloadProgress', (event) => {
        if (event.state === 'completed') downloads.push({ guid: event.guid, name: downloadNames.get(event.guid) });
    });
    const page = await browser.newPage();
    const runtimeErrors = [];
    page.on("pageerror", (error) => runtimeErrors.push(String(error)));
    page.setDefaultTimeout(20000);
    await page.setViewport({ width: 1280, height: 1000 });
    await page.goto(`${base}/login`);
    const loginStatus = await page.evaluate(async ({ email, password }) => (await fetch("/api/auth/hybrid-login", { method: "POST", headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }, body: JSON.stringify({ email, password }) })).status, { email, password });
    assert.equal(loginStatus, 200, "real login must succeed");
    const reportsUrl = `${base}/dashboard/stock?stockTab=reports&stockCategoryId=999999&stockInventoryPage=7&stockItemsPage=4&source=alerts`;
    const response = await page.goto(reportsUrl);
    assert.equal(response.status(), 200);
    await page.waitForSelector(".recharts-bar-rectangle");
    assert.ok((await page.$eval('[role="tab"][data-state="active"]', (node) => node.textContent)).includes("รายงาน"));
    const analytics = await page.evaluate(async (projectCode) => (await fetch(`/api/stock/reports/analytics?projectCode=${encodeURIComponent(projectCode)}`)).json(), projectCode);
    assert.equal(analytics.kpis.issuedRequests, 1);
    assert.equal(analytics.kpis.issuedLines, 1);
    assert.equal(analytics.topMaterials[0].id, item.id);
    assert.deepEqual(analytics.topMaterials[0].quantities, [{ unit: "รีม", quantity: 4 }]);
    process.stdout.write('Live browser: authenticated Overview loaded\n');
    // Apply a real project filter so the real SVG bar has one unambiguous material.
    await page.type('input[name="projectCode"]', projectCode);
    const filteredResponse = page.waitForResponse((r) => r.url().includes('/reports/analytics?') && new URL(r.url()).searchParams.get('projectCode') === projectCode && !new URL(r.url()).searchParams.has('itemId'));
    await page.$eval('form[aria-label="ตัวกรองการจ่ายวัสดุย้อนหลัง"]', (form) => form.requestSubmit());
    assert.equal((await filteredResponse).status(), 200);
    await page.waitForSelector('.recharts-bar-rectangle path');
    const detailResponse = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/stock/reports/analytics' && new URL(r.url()).searchParams.get('itemId') === String(item.id));
    await page.click('.recharts-bar-rectangle path');
    const detail = await (await detailResponse).json();
    assert.equal(detail.filters.projectCode, projectCode);
    assert.equal(detail.detail.rows[0].variantId, variant.id);
    assert.equal(detail.detail.rows[0].quantity, 4);
    await page.waitForFunction((name) => document.activeElement?.textContent === `รายการย่อย: ${name}`, {}, item.name);
    assert.ok(await page.$eval('section[aria-label="รายละเอียดวัสดุ"]', (node) => node.textContent.includes('4 รีม')));
    await page.screenshot({ path: join(output, "desktop.png"), fullPage: true });
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent === 'ปิดรายละเอียด').click());
    await page.waitForFunction(() => !document.querySelector('section[aria-label="รายละเอียดวัสดุ"]'));
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('ดูรายการย่อย')).focus());
    await page.keyboard.press('Enter');
    await page.waitForFunction((name) => document.activeElement?.textContent === `รายการย่อย: ${name}`, {}, item.name);
    await page.setViewport({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: join(output, "mobile.png"), fullPage: true });
    await page.setViewport({ width: 1280, height: 1000 });

    process.stdout.write('Live browser: SVG click, keyboard details and mobile layout passed\n');
    // Snapshot alerts intentionally ignore the historical project/category filters.
    const alert = analytics.lowStock[0];
    assert.ok(alert, 'integration inventory must have an attention variant');
    const inventoryResponse = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/stock/items' && new URL(r.url()).searchParams.get('search') === alert.sku);
    await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent === 'จัดการสต็อก' && b.getAttribute('role') !== 'tab').click());
    const inventory = await inventoryResponse;
    assert.equal(inventory.status(), 200);
    const inventoryQuery = new URL(inventory.url()).searchParams;
    assert.equal(inventoryQuery.get('page'), '1');
    assert.equal(inventoryQuery.has('categoryId'), false);
    assert.ok((await inventory.json()).items.some((row) => row.id === alert.itemId));
    await page.waitForFunction((sku) => new URL(location.href).searchParams.get('stockSearch') === sku && document.querySelector('input[name="stock-search"]')?.value === sku, {}, alert.sku);
    const destination = new URL(page.url()).searchParams;
    assert.equal(destination.get('stockTab'), 'inventory');
    assert.equal(destination.get('stockInventoryPage'), '1');
    assert.equal(destination.has('stockCategoryId'), false);
    assert.equal(destination.get('source'), 'alerts');
    await page.goBack();
    await page.waitForFunction(() => new URL(location.href).searchParams.get('stockTab') === 'reports');
    assert.equal(new URL(page.url()).searchParams.get('stockCategoryId'), '999999');
    await page.goForward();
    await page.waitForFunction((sku) => document.querySelector('input[name="stock-search"]')?.value === sku, {}, alert.sku);
    assert.equal(new URL(page.url()).searchParams.get('stockSearch'), alert.sku);
    await page.goBack();
    await page.waitForSelector('.recharts-bar-rectangle path');

    process.stdout.write('Live browser: Inventory SKU navigation and back/forward passed\n');
    async function clickExcel(label, mode) {
        const previousDownloads = downloads.length;
        const response = page.waitForResponse((r) => {
            const url = new URL(r.url());
            return url.pathname === '/api/stock/reports/export' && url.searchParams.get('format') === 'xlsx' && (url.searchParams.get('reportType') || 'requests') === mode;
        });
        await page.waitForFunction((label) => [...document.querySelectorAll('button')].some((b) => b.textContent === label && !b.disabled), {}, label);
        await page.evaluate((label) => [...document.querySelectorAll('button')].find((b) => b.textContent === label).click(), label);
        const result = await response;
        assert.equal(result.status(), 200);
        assert.ok(result.headers()['content-disposition'].includes('.xlsx'));
        const deadline = Date.now() + 20000;
        while (downloads.length === previousDownloads && Date.now() < deadline) await new Promise((done) => setTimeout(done, 100));
        const download = downloads[previousDownloads];
        assert.ok(download, 'Chrome must finish saving the workbook');
        assert.ok(download.name.endsWith('.xlsx'));
        assert.ok(download.name.startsWith(mode === 'requests' ? `รายงานเบิกวัสดุ_ปี-${analytics.filters.year}` : 'ยอดคงเหลือสต๊อกปัจจุบัน'));
        const bytes = await readFile(join(output, download.guid));
        assert.ok(bytes.length > 0);
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(bytes);
        return workbook;
    }
    const excelTab = await page.evaluateHandle(() => [...document.querySelectorAll('[role="tab"]')].find((tab) => tab.textContent === 'รายงาน Excel'));
    assert.ok(excelTab.asElement(), 'Excel tab must be available');
    await excelTab.asElement().click();
    await page.waitForSelector('[role="combobox"][aria-label="เลือกปีรีพอร์ตวัสดุ"]');
    const yearText = await page.$eval('[role="combobox"][aria-label="เลือกปีรีพอร์ตวัสดุ"]', (node) => node.textContent);
    if (!yearText.includes(String(analytics.filters.year))) {
        await page.click('[role="combobox"][aria-label="เลือกปีรีพอร์ตวัสดุ"]');
        const yearOption = await page.evaluateHandle((year) => [...document.querySelectorAll('[role="option"]')].find((option) => option.textContent === String(year)), analytics.filters.year);
        assert.ok(yearOption.asElement(), 'the fixture issue year must be selectable');
        await yearOption.asElement().click();
    }
    const annual = await clickExcel('ดาวน์โหลด Excel', 'requests');
    assert.deepEqual(annual.worksheets.map((sheet) => sheet.name), ['สรุปการใช้วัสดุ', 'รายละเอียดที่ใช้คำนวณ']);
    const detailRows = [];
    annual.worksheets[1].eachRow((row, index) => { if (index > 1 && row.getCell(4).value === projectCode) detailRows.push(row); });
    assert.equal(detailRows.length, 1);
    assert.equal(detailRows[0].getCell(10).value, 4);
    const balances = await clickExcel('ดาวน์โหลด Excel สต๊อกคงเหลือ', 'balances');
    assert.deepEqual(balances.worksheets.map((sheet) => sheet.name), ['ยอดคงเหลือจริง']);
    const balanceRows = [];
    balances.worksheets[0].eachRow((row, index) => { if (index > 1 && row.getCell(2).value === item.name) balanceRows.push(row); });
    assert.equal(balanceRows.length, 1);
    assert.deepEqual([5, 6, 7, 8].map((col) => balanceRows[0].getCell(col).value), [10, 3, 7, 12]);
    await page.screenshot({ path: join(output, 'excel.png'), fullPage: true });
    for (const mode of ['raw-issued', 'raw-inventory']) {
        assert.equal(await page.evaluate(async (mode) => (await fetch(`/api/stock/reports/export?reportType=${mode}`)).status, mode), 400);
        assert.equal(await page.evaluate(async (mode) => (await fetch(`/api/stock/reports/export?reportType=${mode}&metaOnly=1`)).status, mode), 400);
    }
    process.stdout.write('Live browser: both legacy workbooks and removed-mode rejections passed\n');
    // Read-only users keep Overview but cannot export, even by calling the API.
    await prisma.userCapabilityGrant.deleteMany({ where: { userId: user.id, capabilityKey: 'stock.report.export' } });
    assert.equal(await page.evaluate(async () => (await fetch('/api/stock/reports/export')).status), 403);
    await page.reload();
    await page.waitForSelector('.recharts-bar-rectangle path');
    assert.equal(await page.$$eval('[role="tab"]', (tabs) => tabs.some((tab) => tab.textContent === 'รายงาน Excel')), false);
    await prisma.userCapabilityGrant.create({ data: { userId: user.id, capabilityKey: 'stock.report.export', scope: 'ALL' } });
    await prisma.userCapabilityGrant.deleteMany({ where: { userId: user.id, capabilityKey: "stock.report.read" } });
    assert.equal(await page.evaluate(async () => (await fetch("/api/stock/reports/analytics")).status), 403, "revoked read cannot be inferred from export");
    assert.equal(await page.evaluate(async () => (await fetch("/api/stock/reports/export?reportType=balances")).status), 200, "export-only authority is preserved");
    await page.reload();
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent === 'ดาวน์โหลด Excel' && !b.disabled));
    assert.equal(await page.$$eval('[role="tab"]', (tabs) => tabs.some((tab) => tab.textContent === 'ภาพรวม')), false);
    await prisma.userCapabilityGrant.deleteMany({ where: { userId: user.id, capabilityKey: "stock.report.export" } });
    assert.equal(await page.evaluate(async () => (await fetch("/api/stock/reports/export?reportType=requests")).status), 403);
    assert.deepEqual(runtimeErrors, []);
    process.stdout.write(`Stock live production browser passed: login, real SVG bar/keyboard drill-down, atomic filtered inventory navigation/back/forward, both legacy XLSX downloads and reconciliation, mobile layout, removed modes, independent grants and runtime errors. Captures: ${output}\n`);
} catch (error) {
    // Report bounded server diagnostics only; never print test credentials or tokens.
    console.error(serverLog);
    throw error;
} finally {
    await browser?.close();
    server?.kill();
    await prisma.$disconnect();
}
