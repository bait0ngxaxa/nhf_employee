import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

// Renders the real IT analytics report and project CSS with fixture aggregates,
// without starting Next or connecting to an API. `next/link` is replaced by a
// plain anchor because there is no App Router outside Next.
const screenshotDirectory = process.env.IT_ANALYTICS_SCREENSHOT_DIR || null;
const output = await mkdtemp(join(tmpdir(), "nhf-it-analytics-smoke-"));
const linkShim = {
    name: "next-link-shim",
    setup(context) {
        context.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: "navigation", namespace: "navigation-shim" }));
        context.onLoad({ filter: /.*/, namespace: "navigation-shim" }, () => ({
            contents: `import { useMemo, useSyncExternalStore } from "react";
                const subscribe = (listener) => { window.addEventListener("popstate", listener); return () => window.removeEventListener("popstate", listener); };
                const navigate = (method, url) => { history[method](null, "", url); window.dispatchEvent(new PopStateEvent("popstate")); };
                const router = { push: (url) => navigate("pushState", url), replace: (url) => navigate("replaceState", url) };
                export const useRouter = () => router;
                export const usePathname = () => location.pathname;
                export const useSearchParams = () => { const query = useSyncExternalStore(subscribe, () => location.search); return useMemo(() => new URLSearchParams(query), [query]); };`,
            loader: "jsx", resolveDir: process.cwd(),
        }));
        context.onResolve({ filter: /^next\/link$/ }, () => ({ path: "next-link", namespace: "shim" }));
        context.onResolve({ filter: /^next\/image$/ }, () => ({ path: "next-image", namespace: "shim" }));
        context.onLoad({ filter: /.*/, namespace: "shim" }, ({ path }) => ({
            contents: path === "next-image"
                ? `export default function Image({ unoptimized, ...props }) { return <img {...props} />; }`
                : `import React from "react";
                export default function Link({ href, children, ...props }) {
                    return React.createElement("a", { href, ...props }, children);
                }`,
            loader: "jsx",
            resolveDir: process.cwd(),
        }));
    },
};
const bundle = await build({
    stdin: {
        contents: `import React from "react";
            import { createRoot } from "react-dom/client";
            import { ITAnalyticsReport } from "./modules/it/presentation/dashboard/ITAnalyticsDashboard";
            import { ITWorkspace } from "./modules/it/presentation/dashboard/ITWorkspace";
            import { buildITAnalyticsQueueDestinations } from "./modules/it/presentation/dashboard/analytics-url-state";
            import { getITAnalyticsPeriodBounds } from "./modules/it/domain/analytics-period";
            const params = new URLSearchParams(location.search);
            const empty = params.get("empty") === "1";
            const linked = params.get("linked") === "1";
            const names = ["อุปกรณ์คอมพิวเตอร์และอุปกรณ์ต่อพ่วงสำนักงาน", "เครือข่ายและอินเทอร์เน็ต", "อีเมลและบัญชีผู้ใช้",
                "โปรแกรมสำนักงาน", "เครื่องพิมพ์", "ระบบภายใน NHF", "โทรศัพท์และการประชุมออนไลน์", "สิทธิ์การเข้าถึงไฟล์",
                "กล้องวงจรปิด", "อื่น ๆ"];
            const rows = empty ? [] : names.map((label, index) => ({ categoryId: index + 1, label, count: 42 - index * 4 }));
            if (!empty) rows.splice(3, 0, { categoryId: null, label: "ยังไม่จัดหมวดหมู่", count: 30 });
            const now = new Date("2026-11-07T03:00:00.000Z");
            const reportWindow = (key) => {
                const bounds = getITAnalyticsPeriodBounds(key, now);
                const period = { key, startAt: bounds.startAt.toISOString(), endAt: bounds.endAt.toISOString() };
                const previousPeriod = {
                    startAt: bounds.previous.startAt.toISOString(), endAt: bounds.previous.endAt.toISOString(),
                    newTickets: empty ? { count: 0, percentageChange: 0 } : { count: 148, percentageChange: 100 },
                    resolvedTickets: empty ? { count: 0, percentageChange: 0 } : { count: 300, percentageChange: -29 / 3 },
                };
                const weights = bounds.dates.map((_, index) => 1 + (index * 7) % 9);
                const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
                let cumulativeWeight = 0;
                const trend = bounds.dates.map((date, index) => {
                    const start = cumulativeWeight / totalWeight;
                    cumulativeWeight += weights[index];
                    const end = cumulativeWeight / totalWeight;
                    return {
                        date,
                        created: empty ? 0 : Math.floor(296 * end) - Math.floor(296 * start),
                        resolved: empty ? 0 : Math.floor(271 * end) - Math.floor(271 * start),
                    };
                });
                return { period, previousPeriod, trend };
            };
            const priorities = ["P0", "P1", "P2", "P3"];
            const dashboard = {
                generatedAt: now.toISOString(), timeZone: "Asia/Bangkok",
                ...reportWindow("30D"),
                filters: { type: null, category: null },
                filterOptions: { categories: names.map((name, index) => ({ id: index + 1, key: "K" + index, name, isActive: index !== 9 })) },
                summary: empty ? {
                    currentBacklog: 0, waitingRequester: 0, unassignedBacklog: 0, untriagedBacklog: 0, highPriorityBacklog: 0,
                    agedBacklog: 0, oldestUnresolvedAgeMinutes: null, newTickets: 0, resolvedTickets: 0,
                    closedTickets: 0, cancelledTickets: 0, reopenedTickets: 0,
                } : {
                    currentBacklog: 64, waitingRequester: 6, unassignedBacklog: 9, untriagedBacklog: 5, highPriorityBacklog: 11,
                    agedBacklog: 14, oldestUnresolvedAgeMinutes: 38_000, newTickets: 296, resolvedTickets: 271,
                    closedTickets: 240, cancelledTickets: 9, reopenedTickets: 14,
                },
                statusDistribution: ["OPEN", "IN_PROGRESS", "WAITING_REQUESTER", "RESOLVED", "CLOSED", "CANCELLED"]
                    .map((status, index) => ({ status, count: empty ? 0 : [30, 28, 6, 12, 240, 9][index] })),
                typeDistribution: ["INCIDENT", "SERVICE_REQUEST", "SUGGESTION"].map((type, index) => ({ type, count: empty ? 0 : [180, 104, 12][index] })),
                priorityDistribution: priorities.map((priority, index) => ({ priority, count: empty ? 0 : [12, 40, 220, 53][index] })),
                priorityBacklog: priorities.map((priority, index) => ({ priority, count: empty ? 0 : [3, 8, 41, 12][index] })),
                topCategories: { limit: 10, rows: rows.slice(0, 10), otherCategoryCount: empty ? 0 : 1, otherTicketCount: empty ? 0 : 6 },
                backlogAging: [["0_1", 22], ["2_3", 15], ["4_7", 13], ["8_14", 9], ["15_PLUS", 5]].map(([bucket, count]) => ({ bucket, count: empty ? 0 : count })),
                categoryBacklog: empty ? [] : [{ label: "เครือข่ายและอินเทอร์เน็ต", count: 20 }, { label: "ยังไม่จัดหมวดหมู่", count: 9 }],
                assigneeBacklog: empty ? [] : [
                    { label: "สมชาย ใจดี", count: 18 }, { label: "วิไลวรรณ ศรีสุวรรณภูมิพัฒนา", count: 14 },
                    { label: "ยังไม่มีผู้รับผิดชอบ", count: 9 },
                    ...Array.from({ length: 7 }, (_, index) => ({ label: "เจ้าหน้าที่ " + (index + 1), count: 6 - Math.floor(index / 2) })),
                    { label: "ผู้รับผิดชอบเดิม", count: 2 },
                ],
                departmentCreated: empty ? [] : [
                    { label: "สำนักงานประสานงานโครงการและส่งเสริมการมีส่วนร่วมของชุมชน", count: 112 },
                    { label: "ฝ่ายบริหารและทรัพยากรบุคคล", count: 79 },
                    { label: "ฝ่ายพัฒนานโยบาย", count: 33 },
                    { label: "ฝ่ายบัญชีและการเงิน", count: 19 },
                    { label: "ฝ่ายสื่อสารองค์กร", count: 14 },
                    { label: "ศูนย์ข้อมูลและประสานงาน", count: 11 },
                    { label: "ฝ่ายบริการสำนักงาน", count: 9 },
                    { label: "กลุ่มงานวิชาการ", count: 7 },
                    { label: "สำนักงานเดิม", count: 6 },
                    { label: "ไม่ระบุหน่วยงาน", count: 4 },
                    { label: "ฝ่ายแผนงาน", count: 2 },
                ],
            };
            const navigation = linked ? buildITAnalyticsQueueDestinations(dashboard.filters) : undefined;
            if (params.get("full") === "1") {
                // Real container with filters; the API is stubbed with the same aggregates.
                window.analyticsRequests = [];
                window.fetch = async (input) => {
                    window.analyticsRequests.push(String(input));
                    if (!String(input).startsWith("/api/it/analytics?")) throw new Error("Unexpected Ticket API request");
                    const query = new URL(String(input), location.href).searchParams;
                    const category = query.get("category");
                    const filters = { type: query.get("type"), category: category === "uncategorized" ? category : category === null ? null : Number(category) };
                    const filteredRows = category === null ? rows.slice(0, 10) : rows.filter((row) => String(row.categoryId ?? "uncategorized") === category);
                    if (params.get("loading") === "1") return new Promise(() => {});
                    return new Response(JSON.stringify({ success: true, dashboard: { ...dashboard,
                        filters, ...reportWindow(query.get("period")),
                        topCategories: { ...dashboard.topCategories, rows: filteredRows, otherCategoryCount: category === null ? 1 : 0, otherTicketCount: category === null ? 6 : 0 },
                    } }), { status: params.get("error") === "1" ? 503 : 200, headers: { "Content-Type": "application/json" } });
                };
            }
            createRoot(document.getElementById("root")).render(
                <main className="mx-auto max-w-7xl px-4 py-6">{params.get("full") === "1"
                    ? <ITWorkspace capabilities={{ canReadAnalytics: true, canReadAllTickets: linked,
                        canReadOwnTickets: false, canCreateOwnTickets: false, canCommentOwnTickets: false,
                        canCommentAllTickets: false, canManageTickets: false }} />
                    : <ITAnalyticsReport dashboard={dashboard} navigation={navigation} />}</main>
            );`,
        resolveDir: process.cwd(), loader: "tsx",
    },
    bundle: true, write: false, jsx: "automatic", plugins: [linkShim],
    loader: { ".svg": "dataurl" },
    define: { "process.env.NODE_ENV": "\"production\"" },
});
const css = await postcss([tailwind()]).process(await readFile("app/globals.css", "utf8"), {
    from: resolve("app/globals.css"),
});
await writeFile(join(output, "report.js"), bundle.outputFiles[0].contents);
await writeFile(join(output, "index.html"), `<!doctype html><html lang="th"><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>${css.css}</style><body class="bg-background"><div id="root"></div><script src="report.js"></script></body></html>`, "utf8");

// PUPPETEER_MODULE may point at a puppeteer-core entry outside the repository.
const { default: puppeteer } = await import(process.env.PUPPETEER_MODULE
    ? pathToFileURL(resolve(process.env.PUPPETEER_MODULE)).href
    : "puppeteer");
const browser = await puppeteer.launch({
    executablePath: process.env.CHART_BROWSER_PATH || undefined,
    headless: true,
});
const failures = [];
let cases = 0;
const supportedWidths = [320, 390, 768, 1024, 1440];
const widths = process.argv[2] ? [Number(process.argv[2])] : supportedWidths;
assert.ok(widths.every((width) => supportedWidths.includes(width)), "Use a supported viewport width");
try {
    for (const width of widths) {
        for (const variant of ["data", "linked", "empty", "full", "full-operator", "loading", "error"]) {
            for (const dark of [false, true]) {
                const page = await browser.newPage();
                page.setDefaultTimeout(5000);
                const key = `${width}px ${variant} ${dark ? "dark" : "light"}`;
                const errors = [];
                page.on("pageerror", (error) => errors.push(String(error)));
                try {
                    await page.setViewport({ width, height: 900, hasTouch: width < 1024 });
                    const query = { empty: "?empty=1", linked: "?linked=1", full: "?full=1&itTab=analytics&reportPeriod=90D&reportType=INCIDENT", "full-operator": "?full=1&linked=1&itTab=analytics&reportPeriod=90D&reportType=INCIDENT", loading: "?full=1&loading=1&itTab=analytics", error: "?full=1&error=1&itTab=analytics", data: "" }[variant];
                    await page.goto(`${pathToFileURL(join(output, "index.html"))}${query}`);
                    if (dark) await page.evaluate(() => document.documentElement.classList.add("dark"));
                    if (variant === "loading" || variant === "error") {
                        const selector = variant === "loading" ? '[aria-label="กำลังโหลดรายงาน IT"]' : '[role="alert"]';
                        await page.waitForSelector(selector);
                        if (variant === "loading") {
                            assert.equal(await page.$eval('button[disabled]', (button) => button.disabled), true);
                        }
                        assert.equal(await page.$$eval('[aria-label="ตัวกรองรายงาน"] [role="combobox"]', (items) => items.length), 3);
                        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
                        if (variant === "error") {
                            const before = await page.evaluate(() => window.analyticsRequests.length);
                            await page.evaluate(() => [...document.querySelectorAll("button")].find((button) => button.textContent.includes("ลองอีกครั้ง")).click());
                            await page.waitForFunction((count) => window.analyticsRequests.length > count && document.querySelector('[role="alert"]'), {}, before);
                        }
                        assert.deepEqual(errors, [], "state must not throw");
                        cases += 1;
                        continue;
                    }
                    await page.waitForSelector(variant === "empty" ? '[role="status"]' : ".recharts-bar");
                    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
                    const layout = await page.evaluate(() => ({
                        overflow: document.documentElement.scrollWidth > innerWidth,
                        overflowing: [...document.querySelectorAll("main *")]
                            .filter((element) => {
                                const box = element.getBoundingClientRect();
                                return box.width > 0 && box.right > innerWidth + 1
                                    && !element.closest(".overflow-x-auto");
                            })
                            .slice(0, 3)
                            .map((element) => `${element.tagName}.${String(element.className).slice(0, 60)}`),
                        sections: document.querySelectorAll("main section").length,
                        kpiGroups: [...document.querySelectorAll(
                            '[aria-labelledby="it-analytics-period-title"] dl, [aria-labelledby="it-analytics-snapshot-title"] > dl',
                        )]
                            .map((group) => ({
                                metrics: group.querySelectorAll("dt").length,
                                columns: getComputedStyle(group).gridTemplateColumns.split(" ").length,
                            })),
                        departmentCount: document.querySelectorAll('[aria-label="รายการหน่วยงานทั้งหมด"] li').length,
                        hasDurationMetrics: /ตอบกลับครั้งแรกเฉลี่ย|เวลาแก้ไขเฉลี่ย|ประสิทธิภาพการให้บริการ/.test(document.querySelector("main").textContent),
                        smallTargets: [...document.querySelectorAll("main a, main button")]
                            .filter((element) => element.getBoundingClientRect().height < 36)
                            .map((element) => element.textContent),
                    }));
                    assert.equal(layout.overflow, false, `page must not overflow horizontally: ${layout.overflowing.join(", ")}`);
                    assert.ok(layout.sections >= 8, "every remaining report section must render");
                    assert.deepEqual(layout.kpiGroups, [
                        { metrics: 2, columns: 2 },
                        { metrics: 3, columns: 3 },
                        { metrics: 4, columns: width >= 1280 ? 4 : 2 },
                    ], "all KPI groups must fill their grid");
                    assert.equal(layout.departmentCount, variant === "empty" ? 0 : 11, "all department rows must be present");
                    if (variant === "full" || variant === "full-operator") {
                        const departmentList = '[aria-label="รายการหน่วยงานทั้งหมด"]';
                        await page.$eval(departmentList, (element) => element.focus());
                        await page.keyboard.press("End");
                        await page.waitForFunction((selector) => document.querySelector(selector)?.scrollTop > 0, {}, departmentList);
                        await page.$eval(departmentList, (element) => { element.scrollTop = 0; });
                        await page.evaluate(() => window.scrollTo(0, 0));
                    }
                    assert.equal(layout.hasDurationMetrics, false, "duration metrics must be absent");
                    assert.deepEqual(layout.smallTargets, [], "interactive targets must stay touch-sized");
                    if (variant !== "empty") {
                        // Below 640px the ranked list replaces the category chart by design.
                        const heights = await page.$$eval('[data-slot="chart"]', (charts) => charts
                            .filter((chart) => chart.closest(".hidden") === null || getComputedStyle(chart.closest(".hidden")).display !== "none")
                            .map((chart) => chart.getBoundingClientRect().height));
                        assert.ok(heights.length >= (width >= 640 ? 4 : 3), "every visible chart must render");
                        assert.ok(heights.every((height) => height > 0), "charts must have measurable height");
                        const rankedItems = await page.$$eval('[aria-label="อันดับหมวดปัญหาและจำนวน Ticket"] li', (items) => items.length);
                        assert.equal(rankedItems, 10, "ranked category list must stay available at every width");
                        if (width >= 640) {
                            // Keyboard: the ranked category chart exposes its tooltip.
                            await page.$eval('[aria-label="กราฟแท่งหมวดปัญหา เรียงจากมากไปน้อย"] [role="application"]',
                                (element) => element.focus());
                            await page.keyboard.press("ArrowRight");
                            await page.waitForFunction(() =>
                                document.querySelector('[aria-label="กราฟแท่งหมวดปัญหา เรียงจากมากไปน้อย"] .recharts-tooltip-wrapper')
                                    ?.textContent?.includes("Ticket"));
                        }
                    }
                    if (variant === "full" || variant === "full-operator") {
                        const filterGroup = await page.$('[role="group"][aria-label="ตัวกรองรายงาน"]');
                        assert.ok(filterGroup, "report filters must render");
                        const comboboxes = await page.$$eval('[role="group"] [role="combobox"]', (items) =>
                            items.map((item) => item.getBoundingClientRect().height));
                        assert.equal(comboboxes.length, 3, "period, type and category filters must render");
                        assert.ok(comboboxes.every((height) => height >= 44), "filter controls must stay touch-sized");
                    }
                    if (variant === "linked" || variant === "full-operator") {
                        const hrefs = await page.$$eval("main a", (links) => links.map((link) => link.getAttribute("href")));
                        assert.ok(hrefs.every((href) => !href?.includes("queueCategory=uncategorized")), "historical category must not link to queue");
                        assert.ok(hrefs.some((href) => href?.includes("queuePriority=P0")), "P0 attention link must exist");
                        assert.ok(hrefs.every((href) => href?.includes("itTab=queue") && href?.includes("queueStatus=ACTIVE")), "current backlog links must retain ACTIVE population");
                    } else {
                        assert.equal(await page.$$eval("main a", (links) => links.length), 0, "analytics-only view must not link to Tickets");
                    }
                    if (screenshotDirectory && (width === 390 || width === 1440) && (variant === "full" || variant === "full-operator")) {
                        const name = `it-analytics-${width}-${variant}-${dark ? "dark" : "light"}`;
                        const fullHeight = await page.evaluate(() => document.documentElement.scrollHeight);
                        const sliceHeight = 1400;
                        for (let top = 0, index = 0; top < fullHeight; top += sliceHeight, index += 1) {
                            await page.evaluate((y) => window.scrollTo(0, y), top);
                            await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
                            await page.screenshot({
                                path: join(screenshotDirectory, `${name}-${index}.png`),
                                captureBeyondViewport: true,
                                clip: { x: 0, y: top, width, height: Math.min(sliceHeight, fullHeight - top) },
                            });
                        }
                    }
                    if (variant === "full" || variant === "full-operator") {
                        const categoryButtons = '[aria-label="อันดับหมวดปัญหาและจำนวน Ticket"] button';
                        const waitCategory = async (value) => {
                            await page.waitForFunction((expected) => {
                                const params = new URLSearchParams(location.search);
                                return params.get("reportCategory") === expected
                                    && !document.querySelector('[aria-label="กำลังโหลดรายงาน IT"]')
                                    && window.analyticsRequests.at(-1).includes("period=90D&type=INCIDENT" + (expected === null ? "" : "&category=" + expected));
                            }, {}, value);
                        };
                        if (width >= 640) {
                            await page.click('[aria-label="กราฟแท่งหมวดปัญหา เรียงจากมากไปน้อย"] .recharts-bar-rectangle path');
                        } else {
                            await page.$eval(categoryButtons, (button) => button.focus());
                            await page.keyboard.press("Enter");
                        }
                        await waitCategory("1");
                        assert.equal(await page.$$eval(categoryButtons, (items) => items.length), 1, "category cohort must narrow");
                        await page.evaluate(() => history.back());
                        await waitCategory(null);
                        await page.evaluate(() => history.forward());
                        await waitCategory("1");
                        await page.evaluate(() => history.back());
                        await waitCategory(null);
                        await page.$eval('[aria-label="กรองรายงานตามหมวด ยังไม่จัดหมวดหมู่"]', (button) => button.focus());
                        await page.keyboard.press("Space");
                        await waitCategory("uncategorized");
                        await page.click('[aria-label="กรองตามหมวดหมู่"]');
                        await page.waitForSelector('[role="option"]');
                        await page.evaluate(() => [...document.querySelectorAll('[role="option"]')].find((option) => option.textContent.includes("เครือข่ายและอินเทอร์เน็ต")).click());
                        await waitCategory("2");
                        await page.click('[aria-label="กรองตามหมวดหมู่"]');
                        await page.waitForSelector('[role="option"]');
                        await page.evaluate(() => [...document.querySelectorAll('[role="option"]')].find((option) => option.textContent === "ทุกหมวดหมู่").click());
                        await waitCategory(null);
                        if (variant === "full") assert.equal(await page.$$eval("main a", (links) => links.length), 0, "analytics-only interaction must not expose queue links");
                        if (width < 640) {
                            await page.tap('[aria-label="กรองรายงานตามหมวด อีเมลและบัญชีผู้ใช้"]');
                            await waitCategory("3");
                            await page.evaluate(() => history.back());
                            await waitCategory(null);
                        }
                        assert.ok((await page.evaluate(() => window.analyticsRequests)).every((url) => url.startsWith("/api/it/analytics?")), "only aggregate API may be requested");
                    }
                    assert.deepEqual(errors, [], "page must not throw");
                    cases += 1;
                } catch (error) {
                    failures.push(`${key}: ${error instanceof Error ? error.message : String(error)}`);
                } finally {
                    await page.close();
                }
            }
        }
    }
} finally {
    await browser.close();
}
if (failures.length > 0) {
    console.error(failures.join("\n"));
    process.exit(1);
}
process.stdout.write(`IT analytics dashboard browser checks passed: ${cases} cases\n`);
