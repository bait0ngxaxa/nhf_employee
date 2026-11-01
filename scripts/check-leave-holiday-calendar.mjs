import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import puppeteer from "puppeteer";

// Real Leave forms, Radix dialogs and project CSS; deterministic reference data
// at the HTTP boundary. No Next server, credentials or database required.
const output = await mkdtemp(join(tmpdir(), "nhf-holiday-smoke-"));
const screenshots = join(output, "screenshots");
await mkdir(screenshots, { recursive: true });
const mockClient = `export const apiGet = async (url) => {
    window.holidayFetchCount = (window.holidayFetchCount || 0) + 1;
    if (window.holidayFailure) return { success: false, error: "Unavailable" };
    const year = Number(new URL(url, "https://nhf.test").searchParams.get("year") || 2026);
    return { success: true, data: { year, events: [
        { date: "2026-11-02", name: "New Year's Day", classification: "public-holiday" },
        { date: "2026-11-07", name: "Valentine's Day", classification: "observance" },
        { date: "2026-11-07", name: "รายการทดสอบเพิ่มเติมในวันเดียวกัน", classification: "unverified" },
        ...Array.from({ length: 24 }, (_, index) => ({ date: "2026-11-02", name: "รายการวันหยุดยาวสำหรับทดสอบการเลื่อนอ่านบนมือถือ ลำดับ " + (index + 1), classification: "observance" }))
    ] } };
};
export const apiPost = async () => { throw new Error("Mutations are forbidden in this smoke test"); };
export const apiPut = apiPost;
export const fetchWithRefresh = apiPost;
export const fetchLiffWithSessionRecovery = apiPost;
export const isRecoveredLiffUnauthorizedResponse = () => false;
export const LIFF_SESSION_RECOVERED_MUTATION_MESSAGE = "";
export class LiffApiError extends Error {}
export const unwrapLiffResponse = async response => response.data;
export const LIFF_API_REQUEST_OPTIONS = { skipAuthRefresh: true, credentials: "include" };
export const isRecoveredLiffMutation = () => false;`;
const bundle = await build({
    stdin: {
        contents: `import React from "react";
            import { createRoot } from "react-dom/client";
            import { LeaveRequestForm } from "./modules/leave/presentation/dashboard/LeaveRequestForm";
            import { LiffLeaveRequestForm } from "./modules/leave/presentation/liff/LiffLeaveRequestForm";
            const channel = new URLSearchParams(location.search).get("channel");
            const quotas = [{id:"quota", employeeId:1, year:2026, leaveType:"SICK", totalDays:30, usedDays:0, carryBalanceDays:0, effectiveTotalDays:30, remainingDays:30}];
            const close = () => { window.parentClosed = true; };
            createRoot(document.getElementById("root")).render(channel === "liff"
                ? <LiffLeaveRequestForm open quotas={quotas} onOpenChange={close} onSuccess={close} />
                : <LeaveRequestForm open quotas={quotas} onCancel={close} onSuccess={close} />);`,
        resolveDir: process.cwd(), loader: "tsx",
    },
    bundle: true, write: false, jsx: "automatic",
    define: { "process.env": JSON.stringify({ NODE_ENV: "test", NEXT_PUBLIC_FEATURE_LEAVE: "true" }) },
    plugins: [{ name: "mock-authenticated-http", setup(builder) {
        builder.onResolve({ filter: /^@\/(lib\/client\/api-client|modules\/(auth|line)\/client)$/ }, () => ({ path: "mock-http", namespace: "mock" }));
        builder.onLoad({ filter: /.*/, namespace: "mock" }, () => ({ contents: mockClient, loader: "js" }));
    } }],
});
const css = await postcss([tailwind()]).process(await readFile("app/globals.css", "utf8"), { from: resolve("app/globals.css") });
await writeFile(join(output, "calendar.js"), bundle.outputFiles[0].contents);
await writeFile(join(output, "index.html"), `<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css.css}</style><body><div id="root"></div><script src="calendar.js"></script></body></html>`, "utf8");
const browser = await puppeteer.launch({ executablePath: process.env.CHART_BROWSER_PATH || undefined, headless: true });
let cases = 0;
try {
    for (const channel of ["dashboard", "liff"]) {
        for (const width of [320, 390, 768, 1280]) {
            const page = await browser.newPage();
            const errors = [];
            page.on("pageerror", (error) => errors.push(error.message));
            page.setDefaultTimeout(10000);
            await page.setViewport({ width, height: 900, hasTouch: true });
            await page.evaluateOnNewDocument(() => {
                const NativeDate = Date;
                window.Date = class extends NativeDate {
                    constructor(...args) { super(...(args.length ? args : ["2026-11-01T12:00:00+07:00"])); }
                    static now() { return new NativeDate("2026-11-01T12:00:00+07:00").getTime(); }
                };
            });
            await page.goto(`${pathToFileURL(join(output, "index.html"))}?channel=${channel}`);
            await page.waitForSelector('[data-calendar-month="2026-11"]');
            const parent = channel === "liff" ? '[data-slot="sheet-content"]' : '[data-slot="dialog-content"]';
            const day = (number) => `[data-day="2026-11-${String(number).padStart(2, "0")}"] button`;
            const clickText = async (text) => {
                const element = await page.waitForSelector(`button ::-p-text(${text})`);
                await element.click();
            };
            const clickDay = async (number) => {
                const element = await page.waitForSelector(day(number));
                await element.click();
            };
            await page.waitForFunction(() => document.body.textContent.includes("รายการวันหยุดทั้งปี"));
            await clickDay(2);
            await page.waitForSelector('[role="dialog"][aria-label="ข้อมูลวันหยุด"]');
            const bounds = await page.$eval('[role="dialog"][aria-label="ข้อมูลวันหยุด"]', (node) => {
                const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
            });
            assert.ok(bounds.left >= 0 && bounds.right <= width && bounds.top >= 0 && bounds.bottom <= 900, `${channel}/${width}: popover viewport bounds`);
            const parentBounds = await page.$eval(parent, (node) => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; });
            assert.ok(bounds.left >= parentBounds.left && bounds.right <= parentBounds.right && bounds.top >= parentBounds.top && bounds.bottom <= parentBounds.bottom, `${channel}/${width}: popover modal clipping bounds`);
            // Exercise real wheel and touch input; DOM presence alone cannot prove scrollability.
            const detailsSelector = '[role="dialog"][aria-label="ข้อมูลวันหยุด"]';
            const listSelector = `${detailsSelector} [aria-label="รายการวันหยุดในวันที่เลือก"]`;
            const scrollRegion = await page.$(listSelector) ? listSelector : detailsSelector;
            const scrollBox = await page.$eval(scrollRegion, (node) => {
                const r = node.getBoundingClientRect();
                return { x: r.x + r.width / 2, top: r.top, height: r.height, scrollHeight: node.scrollHeight, clientHeight: node.clientHeight };
            });
            assert.ok(scrollBox.scrollHeight > scrollBox.clientHeight && scrollBox.height >= 44, `${channel}/${width}: long reference scroll region`);
            await page.mouse.move(scrollBox.x, scrollBox.top + scrollBox.height / 2);
            await page.mouse.wheel({ deltaY: 120 });
            await page.waitForFunction((selector) => document.querySelector(selector).scrollTop > 0, { timeout: 3000 }, scrollRegion);
            await page.mouse.move(scrollBox.x, scrollBox.top + scrollBox.height / 2);
            await page.mouse.wheel({ deltaY: 5000 });
            await page.waitForFunction((selector) => {
                const node = document.querySelector(selector);
                const region = node.getBoundingClientRect();
                const last = node.querySelector("li:last-child").getBoundingClientRect();
                return last.top >= region.top && last.bottom <= region.bottom + 1;
            }, { timeout: 3000 }, scrollRegion).catch(async (error) => {
                const metrics = await page.$eval(scrollRegion, (node) => {
                    const region = node.getBoundingClientRect();
                    const last = node.querySelector("li:last-child").getBoundingClientRect();
                    return { top: region.top, bottom: region.bottom, lastTop: last.top, lastBottom: last.bottom, scrollTop: node.scrollTop, scrollHeight: node.scrollHeight, clientHeight: node.clientHeight };
                });
                await page.screenshot({ path: join(screenshots, `${channel}-${width}-scroll-failure.png`), fullPage: true });
                throw new Error(`${channel}/${width}: last reference event not visible: ${JSON.stringify(metrics)}`, { cause: error });
            });
            assert.equal(await page.evaluate(() => window.parentClosed), undefined, "scrolling must not dismiss parent");
            await page.screenshot({ path: join(screenshots, `${channel}-${width}-long-events.png`), fullPage: true });
            const beforeTouch = await page.$eval(scrollRegion, (node) => node.scrollTop);
            const touchBox = await page.$eval(scrollRegion, (node) => {
                const r = node.getBoundingClientRect(); return { x: r.x + r.width / 2, top: r.top, height: r.height };
            });
            const direction = beforeTouch > 0 ? 1 : -1;
            const touchStart = direction > 0 ? touchBox.top + 8 : touchBox.top + touchBox.height - 8;
            const distance = Math.min(120, touchBox.height - 16);
            await page.touchscreen.touchStart(touchBox.x, touchStart);
            for (let step = 1; step <= 10; step++) {
                await page.touchscreen.touchMove(touchBox.x, touchStart + direction * distance * step / 10);
                await new Promise((resolve) => setTimeout(resolve, 20));
            }
            await page.touchscreen.touchEnd();
            await page.waitForFunction((selector, previous, movement) => movement > 0
                ? document.querySelector(selector).scrollTop < previous
                : document.querySelector(selector).scrollTop > previous,
            { timeout: 3000 }, scrollRegion, beforeTouch, direction);
            await page.keyboard.press("Escape");
            await page.waitForSelector('[role="dialog"][aria-label="ข้อมูลวันหยุด"]', { hidden: true });
            assert.equal(await page.evaluate(() => window.parentClosed), undefined);
            assert.ok(await page.$eval(day(2), (node) => node === document.activeElement), "Escape restores day focus");
            await page.keyboard.press("ArrowRight");
            assert.ok(await page.$eval(day(3), (node) => node === document.activeElement), "arrow-key navigation");
            await page.keyboard.press("Enter");
            await clickText("ยืนยันวันที่ลา");
            // Tab remains inside the actual parent Dialog/Sheet.
            for (let index = 0; index < 35; index++) {
                await page.keyboard.press("Tab");
                assert.ok(await page.$eval(parent, (node) => node.contains(document.activeElement)), `${channel}/${width}: focus containment`);
            }
            await clickText("หลายวัน");
            await clickDay(2);
            await page.waitForSelector('[role="dialog"][aria-label="ข้อมูลวันหยุด"]');
            const separation = await page.evaluate(() => {
                const grid = document.querySelector('[aria-label="เลือกวันที่ลา"] [role="grid"]').getBoundingClientRect();
                const details = document.querySelector('[role="dialog"][aria-label="ข้อมูลวันหยุด"]').getBoundingClientRect();
                return details.bottom <= grid.top || details.top >= grid.bottom || details.right <= grid.left || details.left >= grid.right;
            });
            assert.ok(separation, `${channel}/${width}: reference details must not cover date boundaries`);
            await clickDay(6);
            await page.waitForSelector('[role="dialog"][aria-label="ข้อมูลวันหยุด"]', { hidden: true });
            assert.equal(await page.$eval(day(4), (node) => node.getAttribute("aria-pressed")), "true", "range endpoint remains clickable after holiday start");
            await clickDay(6);
            assert.ok(await page.$eval('button ::-p-text(ยืนยันวันที่ลา)', (node) => node.closest("button").disabled), "incomplete range");
            await clickDay(9);
            assert.equal(await page.$eval(day(7), (node) => node.getAttribute("aria-pressed")), "true", "weekend inside range");
            assert.equal(await page.$eval(day(8), (node) => node.getAttribute("aria-pressed")), "true");
            await clickText("ยืนยันวันที่ลา");
            assert.ok(await page.evaluate(() => document.body.textContent.includes("วันทำงาน 2 วัน · ขอลา 2 วัน")));
            await clickDay(7);
            await page.waitForSelector('[role="dialog"][aria-label="ข้อมูลวันหยุด"]');
            assert.ok(await page.$eval('[role="dialog"][aria-label="ข้อมูลวันหยุด"]', (node) => node.textContent.includes("รายการทดสอบเพิ่มเติมในวันเดียวกัน")));
            const weekendBounds = await page.$eval('[role="dialog"][aria-label="ข้อมูลวันหยุด"]', (node) => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }; });
            assert.ok(weekendBounds.left >= parentBounds.left && weekendBounds.right <= parentBounds.right && weekendBounds.top >= parentBounds.top && weekendBounds.bottom <= parentBounds.bottom, `${channel}/${width}: weekend details clipped by modal`);
            await page.screenshot({ path: join(screenshots, `${channel}-${width}.png`), fullPage: true });
            // Outside-click dismisses only the reference popover and still selects a date.
            await clickDay(10);
            await page.waitForSelector('[role="dialog"][aria-label="ข้อมูลวันหยุด"]', { hidden: true });
            await clickText("ยกเลิกวันที่ที่กำลังเลือก");
            await page.$eval("textarea", (node) => {
                Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set.call(node, "พักรักษาตัว");
                node.dispatchEvent(new Event("input", { bubbles: true }));
            });
            await clickText("ตรวจสอบคำขอ");
            await page.waitForSelector('[role="group"][aria-label="ตรวจสอบคำขอลา"]');
            assert.ok(await page.$eval('[role="group"][aria-label="ตรวจสอบคำขอลา"]', (node) => node.textContent.includes("28 วัน")));
            await clickText("แก้ไข");
            assert.equal(await page.$eval("textarea", (node) => node.value), "พักรักษาตัว");
            assert.equal(await page.$eval(day(6), (node) => node.getAttribute("aria-pressed")), "true");
            await clickDay(2);
            await page.click('button[aria-label="เดือนถัดไป"]');
            await page.waitForSelector('[role="dialog"][aria-label="ข้อมูลวันหยุด"]', { hidden: true });
            const geometry = await page.$eval(parent, (node) => ({ width: node.clientWidth, scrollWidth: node.scrollWidth }));
            assert.ok(geometry.scrollWidth <= geometry.width + 1, `${channel}/${width}: horizontal overflow`);
            // A new year creates a fresh reference request; failed data must not block selection.
            await page.evaluate(() => { window.holidayFailure = true; });
            await page.click('button[aria-label="เดือนถัดไป"]');
            await page.waitForFunction(() => document.body.textContent.includes("ยังเลือกวันที่ลาได้ตามปกติ"));
            await clickText("วันเดียว");
            await page.click('[data-day="2027-01-04"] button');
            await clickText("ยืนยันวันที่ลา");
            assert.ok(await page.evaluate(() => document.body.textContent.includes("วันที่ในคำขอ: 4 มกราคม 2570")));
            assert.equal(await page.evaluate(() => window.parentClosed), undefined);
            assert.deepEqual(errors, []);
            await page.close(); cases++;
        }
    }
    process.stdout.write(`Leave date-picker Chromium checks passed: ${cases} cases (Dashboard/LIFF × 320/390/768/1280px). Screenshots: ${screenshots}\n`);
} finally {
    await browser.close();
}
