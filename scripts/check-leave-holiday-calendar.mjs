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
const mockClient = `export const apiGet = async () => {
    window.holidayFetchCount = (window.holidayFetchCount || 0) + 1;
    return { success: true, data: { year: 2026, events: [
        { date: "2026-01-01", name: "New Year's Day", classification: "public-holiday" },
        { date: "2026-02-14", name: "Valentine's Day", classification: "observance" },
        { date: "2026-02-14", name: "รายการทดสอบเพิ่มเติมในวันเดียวกัน", classification: "unverified" }
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
            page.on("pageerror", (error) => { errors.push(error.message); console.error(`${channel}/${width}: ${error.message}`); });
            page.setDefaultTimeout(10000);
            await page.setViewport({ width, height: 900 });
            await page.goto(`${pathToFileURL(join(output, "index.html"))}?channel=${channel}`);
            await page.waitForSelector('input[type="date"]');
            await page.$eval("textarea", (node) => {
                const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
                setter.call(node, "ข้อความที่ต้องคงอยู่หลังปิดปฏิทิน");
                node.dispatchEvent(new Event("input", { bubbles: true }));
            });
            const trigger = await page.waitForSelector('button ::-p-text(ดูปฏิทินวันหยุด)');
            await trigger.click();
            await page.waitForSelector("table");
            const holiday = '[role="dialog"]:has(table)';
            const geometry = await page.$eval(holiday, (dialog) => {
                const box = dialog.getBoundingClientRect();
                const annual = dialog.querySelector('[aria-label="เลื่อนดูรายการทั้งปี"]');
                return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: dialog.clientWidth, scrollWidth: dialog.scrollWidth, annualScrollable: annual.scrollHeight > annual.clientHeight };
            });
            assert.ok(geometry.left >= 0 && geometry.right <= width && geometry.top >= 0 && geometry.bottom <= 900, `${channel}/${width}: dialog bounds`);
            assert.ok(geometry.scrollWidth <= geometry.width + 1, `${channel}/${width}: horizontal overflow`);
            // Verify focus containment with the browser's real Tab behavior.
            for (let i = 0; i < 38; i++) {
                await page.keyboard.press("Tab");
                assert.ok(await page.$eval(holiday, (dialog) => dialog.contains(document.activeElement)), `${channel}/${width}: focus escaped`);
            }
            // February contains all classification states and multiple events on one date.
            for (let i = 0; i < 12; i++) {
                const previous = await page.$(`${holiday} button[aria-label="เดือนก่อนหน้า"]`);
                if (await previous.evaluate((node) => node.disabled)) break;
                await previous.click();
            }
            await page.click(`${holiday} button[aria-label="เดือนถัดไป"]`);
            await page.click(`${holiday} button[aria-label^="14 กุมภาพันธ์"]`);
            await page.$eval(`${holiday} [data-slot="dialog-scroll-area"]`, (node) => { node.scrollTop = 0; });
            await page.screenshot({ path: join(screenshots, `${channel}-${width}.png`), fullPage: true });
            // On mobile the annual list and close action must remain reachable by scrolling.
            await page.$eval(`${holiday} [data-slot="dialog-scroll-area"]`, (node) => { node.scrollTop = node.scrollHeight; });
            assert.ok(await page.$eval(`${holiday} [aria-label="รายการวันหยุดทั้งปี"]`, (node) => node.getBoundingClientRect().width > 0));
            await page.keyboard.press("Escape");
            await page.waitForSelector("table", { hidden: true });
            await page.waitForFunction(() => !document.querySelector('[data-slot="dialog-overlay"][data-state="closed"]'));
            assert.equal(await page.$eval("textarea", (node) => node.value), "ข้อความที่ต้องคงอยู่หลังปิดปฏิทิน");
            assert.ok(await page.evaluate(() => document.activeElement?.textContent.includes("ดูปฏิทินวันหยุด")));
            assert.equal(await page.evaluate(() => window.parentClosed), undefined);
            await page.click('button ::-p-text(ดูปฏิทินวันหยุด)');
            await page.waitForSelector("table");
            assert.equal(await page.evaluate(() => window.holidayFetchCount), 1);
            assert.deepEqual(errors, []);
            await page.close();
            cases++;
        }
    }
    process.stdout.write(`Holiday calendar browser checks passed: ${cases} channel/viewport cases (320, 390, 768, 1280px). Screenshots: ${screenshots}\n`);
} finally {
    await browser.close();
}
