import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
const { default: puppeteer } = await import(process.env.STOCK_BROWSER_DRIVER || "puppeteer");

// Isolated browser fixture only. Real production components/CSS; no production API or database changes.
const output = process.env.STOCK_CAPTURE_DIR || await mkdtemp(join(tmpdir(), "nhf-stock-analytics-"));
const materials = Array.from({ length: 10 }, (_, index) => ({
    id: index + 1, name: ["กระดาษถ่ายเอกสารสำหรับสำนักงาน ขนาด A4", "หมึกพิมพ์เลเซอร์", "แฟ้มเอกสาร", "ปากกาลูกลื่น", "กระดาษโน้ต", "ซองเอกสาร", "คลิปหนีบกระดาษ", "เทปกาว", "เครื่องเย็บกระดาษ", "ถ่านไฟฉาย"][index],
    sku: `SKU-${index + 1}`, category: "เครื่องเขียนและวัสดุสำนักงาน", requestCount: 100 - index * 5, lineCount: 120 - index * 5,
    quantities: [{ unit: "ชิ้น", quantity: 200 - index }, { unit: "กล่อง", quantity: 3 }], available: [{ unit: "ชิ้น", quantity: 20 }], health: { healthy: 1, low: 0, out: 1 },
}));
const data = {
    filters: { year: 2026, fromMonth: 1, toMonth: 12, metric: "frequency" },
    period: { start: "2025-12-31T17:00:00Z", end: "2026-12-31T17:00:00Z", timezone: "Asia/Bangkok" },
    kpis: { issuedRequests: 124, issuedLines: 245, pendingRequests: 8, attentionVariants: 3 },
    topMaterials: materials,
    categories: ["เครื่องเขียนและวัสดุสำนักงาน", "อุปกรณ์คอมพิวเตอร์", "อุปกรณ์ประชุม", "วัสดุทำความสะอาด", "อุปกรณ์ห้องครัว", "วัสดุงานช่าง", "อุปกรณ์ทั่วไป"].map((name, index) => ({ id: index + 1, name, lines: index === 0 ? 65 : 30, percentage: (index === 0 ? 65 : 30) / 245 * 100 })),
    stockHealth: { healthy: 27, low: 2, out: 1 },
    lowStock: [{ id: 1, itemId: 1, name: materials[0].name, sku: "PAPER-A4", attributes: "ขนาด: A4, สี: ขาว", unit: "รีม", quantity: 3, reserved: 3, available: 0, minimum: 5, status: "out" }], lowStockTotal: 3,
    options: { categories: [{ id: 1, name: "เครื่องเขียนและวัสดุสำนักงาน" }], units: ["ชิ้น", "กล่อง"] }, detail: null,
    freshness: { generatedAt: "2026-11-06T08:00:00Z", snapshotScope: "current-all-active-variants" },
};
const bundle = await build({
    stdin: { contents: `import React from "react"; import { createRoot } from "react-dom/client";
        import { StockAdminReports } from "./modules/stock/presentation/dashboard/components/StockAdminReports";
        createRoot(document.getElementById("root")).render(<main className="mx-auto max-w-7xl p-4"><p className="mb-4 text-sm text-content-muted">ข้อมูลจำลองเฉพาะการทดสอบ browser</p><StockAdminReports canReadReports canExportReports onInventory={(sku) => { window.inventorySku = sku; }} /></main>);`, resolveDir: process.cwd(), loader: "tsx" },
    bundle: true, write: false, jsx: "automatic",
    plugins: [{ name: "isolated-test-transport", setup(build) {
        build.onResolve({ filter: /^@\/lib\/client\/(api-client|xlsx-download)$/ }, (args) => ({ path: args.path, namespace: "fixture" }));
        build.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({ contents: args.path.endsWith("xlsx-download")
            ? `export async function downloadXlsx(url) { window.downloadUrl = url; }`
            : `const fixture = ${JSON.stringify(data)}; export async function apiGet(url) {
                window.lastRequest = url; const query = new URL(url, location.href).searchParams;
                if (url.includes('/analytics')) {
                    if (query.get('projectCode') === 'FAIL') return { success: false, errorThai: 'ทดสอบข้อผิดพลาดและลองใหม่' };
                    const data = structuredClone(fixture); data.filters = {...data.filters, ...Object.fromEntries(query)};
                    if (query.get('projectCode') === 'EMPTY') data.topMaterials = [];
                    if (query.has('itemId')) data.detail = { page: 1, hasMore: false, rows: [{ variantId: 1, sku: 'PAPER-A4', attributes: 'ขนาด: A4', unit: 'ชิ้น', requests: 100, quantity: 200 }] };
                    return { success: true, data };
                }
                return { success: true, data: { years: [2026], year: 2026, count: 20, maxRows: 5000, categories: fixture.options.categories } };
            }`, loader: "js" }));
    } }],
});
const css = await postcss([tailwind()]).process(await readFile("app/globals.css", "utf8"), { from: resolve("app/globals.css") });
await writeFile(join(output, "app.js"), bundle.outputFiles[0].contents);
await writeFile(join(output, "index.html"), `<!doctype html><html lang="th"><meta charset="utf-8"><style>${css.css}</style><body><div id="root"></div><script src="app.js"></script></body></html>`, "utf8");
const browser = await puppeteer.launch({ headless: true, executablePath: process.env.CHART_BROWSER_PATH || undefined });
let cases = 0;
try {
    for (const width of [320, 390, 768, 1280]) for (const dark of [false, true]) {
        const page = await browser.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(String(error)));
        await page.setViewport({ width, height: 1000 });
        await page.goto(pathToFileURL(join(output, "index.html")).href);
        if (dark) await page.evaluate(() => document.documentElement.classList.add("dark"));
        await page.waitForSelector(".recharts-bar-rectangle");
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}px must not overflow`);
        assert.equal(await page.$$eval(".recharts-pie", (nodes) => nodes.length), 2);
        if ((width === 1280 || width === 390) && !dark) await page.screenshot({ path: join(output, width === 1280 ? "desktop.png" : "mobile.png"), fullPage: true });
        if (width === 1280 && !dark) {
            await page.$eval('[role="application"]', (element) => element.focus());
            await page.keyboard.press("ArrowDown");
            await page.waitForSelector(".recharts-tooltip-wrapper", { visible: true });
            await page.$eval('input[name="projectCode"]', (input) => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, 'BAR-CHECK'); input.dispatchEvent(new Event('input', { bubbles: true })); });
            await page.$eval('form[aria-label="ตัวกรองการจ่ายวัสดุย้อนหลัง"]', (form) => form.requestSubmit());
            await page.waitForFunction(() => window.lastRequest.includes('projectCode=BAR-CHECK'));
            const bars = await page.$$('.recharts-bar-rectangle path');
            await bars[1].click();
            await page.waitForFunction(() => new URL(window.lastRequest, location.href).searchParams.get('itemId') === '2');
            assert.equal(new URL(await page.evaluate(() => window.lastRequest), 'http://localhost').searchParams.get('projectCode'), 'BAR-CHECK');
            await page.waitForFunction(() => document.activeElement?.textContent === 'รายการย่อย: หมึกพิมพ์เลเซอร์');
            await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("ปิดรายละเอียด")).click());
            // The textual alternative must remain reachable and activate with the keyboard.
            await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.includes("ดูรายการย่อย")).focus());
            await page.keyboard.press('Enter');
            await page.waitForFunction(() => new URL(window.lastRequest, location.href).searchParams.get('itemId') === '1');
            await page.waitForFunction(() => document.body.textContent.includes("ปิดรายละเอียด"));
            await page.waitForFunction(() => document.activeElement?.textContent.startsWith("รายการย่อย:"));
            await page.screenshot({ path: join(output, "detail.png"), fullPage: true });
            await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent === "จัดการสต็อก").click());
            assert.equal(await page.evaluate(() => window.inventorySku), "PAPER-A4");
            await page.click('[role="tab"][data-state="inactive"]');
            await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent === 'ดาวน์โหลด Excel' && !b.disabled));
            await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent === 'ดาวน์โหลด Excel').click());
            await page.waitForFunction(() => Boolean(window.downloadUrl));
            assert.equal(await page.evaluate(() => window.downloadUrl), '/api/stock/reports/export?format=xlsx&year=2026');
            await page.evaluate(() => { window.downloadUrl = null; [...document.querySelectorAll('button')].find((b) => b.textContent === 'ดาวน์โหลด Excel สต๊อกคงเหลือ').click(); });
            await page.waitForFunction(() => Boolean(window.downloadUrl));
            assert.equal(await page.evaluate(() => window.downloadUrl), '/api/stock/reports/export?format=xlsx&reportType=balances');
            await page.screenshot({ path: join(output, "export.png"), fullPage: true });
        }
        assert.deepEqual(errors, [], `${width}px runtime errors`);
        cases++;
        await page.close();
    }
    process.stdout.write(`Stock analytics browser: ${cases} responsive/theme cases passed; charts, keyboard tooltip, drill-down, inventory action and explicit legacy Excel downloads passed. Captures: ${output}\n`);
} finally { await browser.close(); }
