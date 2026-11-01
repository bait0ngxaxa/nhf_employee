import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import puppeteer from "puppeteer";

// Real Dashboard/LIFF forms and project CSS; only transport is stubbed. No database or Next server.
const output = await mkdtemp(join(tmpdir(), "nhf-leave-calendar-"));
const bundle = await build({
    stdin: { contents: `import React from "react";
        import { createRoot } from "react-dom/client";
        import { LeaveRequestForm } from "./modules/leave/presentation/dashboard/LeaveRequestForm";
        import { LiffLeaveRequestForm } from "./modules/leave/presentation/liff/LiffLeaveRequestForm";
        const RealDate = Date;
        globalThis.Date = class extends RealDate {
            constructor(...args) { super(...(args.length ? args : ["2026-11-02T12:00:00+07:00"])); }
            static now() { return new RealDate("2026-11-02T12:00:00+07:00").getTime(); }
        };
        const quotas = [{ id: "fixture", employeeId: 1, year: 2026, leaveType: "SICK", totalDays: 30, usedDays: 0, carryBalanceDays: 0, effectiveTotalDays: 30, remainingDays: 30 }];
        const channel = new URLSearchParams(location.search).get("channel");
        createRoot(document.getElementById("root")).render(channel === "liff"
            ? <LiffLeaveRequestForm open quotas={quotas} onOpenChange={() => {}} onSuccess={() => {}} />
            : <LeaveRequestForm open quotas={quotas} onCancel={() => {}} onSuccess={() => {}} />);`,
        resolveDir: process.cwd(), loader: "tsx" },
    bundle: true, write: false, jsx: "automatic", loader: { ".png": "dataurl" },
    define: { "process.env.NEXT_PUBLIC_FEATURE_LEAVE": '"true"', "process.env.NODE_ENV": '"production"', "process.env": '{"NEXT_PUBLIC_FEATURE_LEAVE":"true"}' },
    plugins: [{ name: "fixture-transport", setup(context) {
        context.onResolve({ filter: /lib\/client\/api-client$/ }, () => ({ path: "transport", namespace: "fixture" }));
        context.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: `
            export async function apiGet(url) {
                const year = Number(new URL(url, "http://fixture").searchParams.get("quotaYear"));
                return { success: true, data: url.includes("quotaYear") ? { quotas: [{ year, leaveType: "SICK", effectiveTotalDays: 30, usedDays: 0, remainingDays: 30 }] } : { year: 2026, events: [] } };
            }
            export async function apiPost() { throw new Error("Smoke test must never submit"); }
            export async function apiPut() { throw new Error("Smoke test must never mutate"); }
        ` }));
    } }],
});
const css = await postcss([tailwind()]).process(await readFile("app/globals.css", "utf8"), { from: resolve("app/globals.css") });
await writeFile(join(output, "calendar.js"), bundle.outputFiles[0].contents);
await writeFile(join(output, "index.html"), `<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css.css}</style><body><div id="root"></div><script src="calendar.js"></script></body></html>`, "utf8");
const browser = await puppeteer.launch({ executablePath: process.env.CHART_BROWSER_PATH || undefined, headless: true });
const failures = [];
let passed = 0;
try {
    for (const channel of ["dashboard", "liff"]) for (const width of [320, 390]) {
        const page = await browser.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(String(error)));
        page.setDefaultTimeout(8000);
        const key = `${channel}-${width}`;
        try {
            await page.setViewport({ width, height: 900, hasTouch: true });
            await page.goto(`${pathToFileURL(join(output, "index.html"))}?channel=${channel}`);
            await page.waitForSelector('[aria-label="เลือกเดือน"]');
            assert.equal(await page.$eval('[aria-label="เลือกปี พ.ศ."]', (select) => select.selectedOptions[0].text), "2569");
            await page.select('[aria-label="เลือกเดือน"]', "11");
            await page.select('[aria-label="เลือกปี พ.ศ."]', "2029");
            assert.equal(await page.$eval('[aria-label="เลือกวันที่ลา"]', (section) => section.dataset.calendarMonth), "2029-12");
            assert.match(await page.$eval('[aria-label="เลือกวันที่ลา"]', (section) => section.textContent), /วันที่ในคำขอ: 2 พฤศจิกายน 2569/);
            await page.click('[aria-label="เดือนถัดไป"]');
            assert.equal(await page.$eval('[aria-label="เลือกวันที่ลา"]', (section) => section.dataset.calendarMonth), "2030-01");
            await page.focus('[aria-label="เลือกเดือน"]');
            await page.keyboard.press("ArrowDown");
            await page.keyboard.press("Enter");
            assert.equal(await page.$eval('[aria-label="เลือกเดือน"]', (select) => select.value), "1");
            await page.select('[aria-label="เลือกปี พ.ศ."]', "2026");
            await page.select('[aria-label="เลือกเดือน"]', "10");
            await page.click('[data-day="2026-11-06"] button');
            await page.select('[aria-label="เลือกเดือน"]', "11");
            assert.match(await page.$eval('[aria-label="เลือกวันที่ลา"]', (section) => section.textContent), /กำลังเลือก: 6 พฤศจิกายน 2569/);
            await page.evaluate(() => [...document.querySelectorAll("button")].find((button) => button.textContent === "ยกเลิกวันที่ที่กำลังเลือก").click());
            assert.equal(await page.$eval('[aria-label="เลือกวันที่ลา"]', (section) => section.dataset.calendarMonth), "2026-11");
            await page.$eval('[aria-label="เลือกเดือน"]', (select) => select.scrollIntoView({ block: "center" }));
            const layout = await page.evaluate(() => ({
                overflow: document.documentElement.scrollWidth > innerWidth,
                selectors: [...document.querySelectorAll('[aria-label="เลือกเดือน"], [aria-label="เลือกปี พ.ศ."]')].map((select) => {
                    const rect = select.getBoundingClientRect();
                    return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight && rect.height >= 44;
                }),
            }));
            assert.equal(layout.overflow, false);
            assert.ok(layout.selectors.every(Boolean), "navigation must fit and retain touch targets");
            assert.deepEqual(errors, []);
            await page.screenshot({ path: join(output, `${key}.png`) });
            passed++;
        } catch (error) { failures.push(`${key}: ${error.message}; runtime: ${errors.join("; ")}`); }
        finally { await page.close(); }
    }
} finally { await browser.close(); }
process.stdout.write(`${JSON.stringify({ passed, failures, artifacts: output }, null, 2)}\n`);
if (failures.length) process.exitCode = 1;
