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
        context.onLoad({ filter: /.*/, namespace: "shim" }, () => ({
            contents: `import React from "react";
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
            const params = new URLSearchParams(location.search);
            const empty = params.get("empty") === "1";
            const linked = params.get("linked") === "1";
            const names = ["อุปกรณ์คอมพิวเตอร์และอุปกรณ์ต่อพ่วงสำนักงาน", "เครือข่ายและอินเทอร์เน็ต", "อีเมลและบัญชีผู้ใช้",
                "โปรแกรมสำนักงาน", "เครื่องพิมพ์", "ระบบภายใน NHF", "โทรศัพท์และการประชุมออนไลน์", "สิทธิ์การเข้าถึงไฟล์",
                "กล้องวงจรปิด", "อื่น ๆ"];
            const rows = empty ? [] : names.map((label, index) => ({ categoryId: index + 1, label, count: 42 - index * 4 }));
            if (!empty) rows.splice(3, 0, { categoryId: null, label: "ยังไม่จัดหมวดหมู่", count: 30 });
            const trend = Array.from({ length: 30 }, (_, index) => ({
                date: new Date(Date.UTC(2026, 9, 8 + index)).toISOString().slice(0, 10),
                created: empty ? 0 : (index * 7) % 9, resolved: empty ? 0 : (index * 5) % 7,
            }));
            const priorities = ["P0", "P1", "P2", "P3"];
            const dashboard = {
                generatedAt: "2026-11-07T03:00:00.000Z", timeZone: "Asia/Bangkok",
                period: { key: "30D", startAt: "2026-10-08T17:00:00.000Z", endAt: "2026-11-07T03:00:00.000Z" },
                filters: { type: null, category: null },
                filterOptions: { categories: names.map((name, index) => ({ id: index + 1, key: "K" + index, name, isActive: index !== 9 })) },
                summary: empty ? {
                    currentBacklog: 0, waitingRequester: 0, unassignedBacklog: 0, untriagedBacklog: 0, highPriorityBacklog: 0,
                    agedBacklog: 0, oldestUnresolvedAgeMinutes: null, newTickets: 0, resolvedTickets: 0, firstRespondedTickets: 0,
                    averageFirstResponseMinutes: null, averageResolutionMinutes: null,
                } : {
                    currentBacklog: 64, waitingRequester: 6, unassignedBacklog: 9, untriagedBacklog: 5, highPriorityBacklog: 11,
                    agedBacklog: 14, oldestUnresolvedAgeMinutes: 38_000, newTickets: 296, resolvedTickets: 271, firstRespondedTickets: 280,
                    averageFirstResponseMinutes: 47.4, averageResolutionMinutes: 1_710,
                },
                trend,
                statusDistribution: ["OPEN", "IN_PROGRESS", "WAITING_REQUESTER", "RESOLVED", "CLOSED", "CANCELLED"]
                    .map((status, index) => ({ status, count: empty ? 0 : [30, 28, 6, 12, 240, 9][index] })),
                typeDistribution: ["INCIDENT", "SERVICE_REQUEST", "SUGGESTION"].map((type, index) => ({ type, count: empty ? 0 : [180, 104, 12][index] })),
                priorityDistribution: priorities.map((priority, index) => ({ priority, count: empty ? 0 : [12, 40, 220, 53][index] })),
                priorityBacklog: priorities.map((priority, index) => ({ priority, count: empty ? 0 : [3, 8, 41, 12][index] })),
                responseResolutionByPriority: priorities.map((priority, index) => ({
                    priority, firstRespondedTickets: empty ? 0 : [10, 38, 190, 42][index],
                    averageFirstResponseMinutes: empty || index === 3 ? null : [6, 18, 52, 0][index],
                    resolvedTickets: empty ? 0 : [9, 35, 180, 47][index],
                    averageResolutionMinutes: empty ? null : [95, 410, 1_900, 4_200][index],
                })),
                topCategories: { limit: 10, rows: rows.slice(0, 10), otherCategoryCount: empty ? 0 : 1, otherTicketCount: empty ? 0 : 6 },
                backlogAging: [["0_1", 22], ["2_3", 15], ["4_7", 13], ["8_14", 9], ["15_PLUS", 5]].map(([bucket, count]) => ({ bucket, count: empty ? 0 : count })),
                categoryBacklog: empty ? [] : [{ label: "เครือข่ายและอินเทอร์เน็ต", count: 20 }, { label: "ยังไม่จัดหมวดหมู่", count: 9 }],
                assigneeBacklog: empty ? [] : [
                    { label: "สมชาย ใจดี", count: 18 }, { label: "วิไลวรรณ ศรีสุวรรณภูมิพัฒนา", count: 14 },
                    { label: "ยังไม่มีผู้รับผิดชอบ", count: 9 },
                    ...Array.from({ length: 7 }, (_, index) => ({ label: "เจ้าหน้าที่ " + (index + 1), count: 6 - Math.floor(index / 2) })),
                    { label: "ผู้รับผิดชอบเดิม", count: 2 },
                ],
                departmentCreated: empty ? [] : [{ label: "ฝ่ายบริหาร", count: 120 }, { label: "ไม่ระบุหน่วยงาน", count: 4 }],
            };
            const navigation = linked ? {
                getPriorityHref: (priority) => "/dashboard/it?itTab=queue&queuePriority=" + priority,
                unassignedHref: "/dashboard/it?itTab=queue&queueAssignment=UNASSIGNED",
                untriagedHref: "/dashboard/it?itTab=queue&queueTriage=UNTRIAGED",
            } : undefined;
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
                        filters, period: { ...dashboard.period, key: query.get("period") },
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
const widths = process.argv[2] ? [Number(process.argv[2])] : [320, 390, 768, 1280];
assert.ok(widths.every((width) => [320, 390, 768, 1280].includes(width)), "Use a supported viewport width");
try {
    for (const width of widths) {
        for (const variant of ["data", "linked", "empty", "full"]) {
            for (const dark of [false, true]) {
                const page = await browser.newPage();
                page.setDefaultTimeout(5000);
                const key = `${width}px ${variant} ${dark ? "dark" : "light"}`;
                const errors = [];
                page.on("pageerror", (error) => errors.push(String(error)));
                try {
                    await page.setViewport({ width, height: 900, hasTouch: width < 1024 });
                    const query = { empty: "?empty=1", linked: "?linked=1", full: "?full=1&itTab=analytics&reportPeriod=90D&reportType=INCIDENT", data: "" }[variant];
                    await page.goto(`${pathToFileURL(join(output, "index.html"))}${query}`);
                    if (dark) await page.evaluate(() => document.documentElement.classList.add("dark"));
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
                        smallTargets: [...document.querySelectorAll("main a, main button")]
                            .filter((element) => element.getBoundingClientRect().height < 36)
                            .map((element) => element.textContent),
                    }));
                    assert.equal(layout.overflow, false, `page must not overflow horizontally: ${layout.overflowing.join(", ")}`);
                    assert.ok(layout.sections >= 8, "every report section must render");
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
                                document.querySelector(".recharts-tooltip-wrapper")?.textContent?.includes("Ticket"));
                        }
                    }
                    if (variant === "full") {
                        const filterGroup = await page.$('[role="group"][aria-label="ตัวกรองรายงาน"]');
                        assert.ok(filterGroup, "report filters must render");
                        const comboboxes = await page.$$eval('[role="group"] [role="combobox"]', (items) =>
                            items.map((item) => item.getBoundingClientRect().height));
                        assert.equal(comboboxes.length, 3, "period, type and category filters must render");
                        assert.ok(comboboxes.every((height) => height >= 44), "filter controls must stay touch-sized");
                    }
                    if (variant === "linked") {
                        const hrefs = await page.$$eval("main a", (links) => links.map((link) => link.getAttribute("href")));
                        assert.ok(hrefs.every((href) => !href?.includes("queueCategory=uncategorized")), "historical category must not link to queue");
                        assert.ok(hrefs.some((href) => href?.includes("queuePriority=P0")), "P0 attention link must exist");
                    } else {
                        assert.equal(await page.$$eval("main a", (links) => links.length), 0, "analytics-only view must not link to Tickets");
                    }
                    if (screenshotDirectory && (width === 390 || width === 1280) && variant !== "linked" && !(variant === "full" && dark)) {
                        const name = `it-analytics-${width}-${variant}-${dark ? "dark" : "light"}`;
                        const fullHeight = await page.evaluate(() => document.documentElement.scrollHeight);
                        const sliceHeight = width < 768 ? 1400 : fullHeight;
                        for (let top = 0, index = 0; top < fullHeight; top += sliceHeight, index += 1) {
                            await page.screenshot({
                                path: join(screenshotDirectory, `${name}-${index}.png`),
                                captureBeyondViewport: true,
                                clip: { x: 0, y: top, width, height: Math.min(sliceHeight, fullHeight - top) },
                            });
                        }
                    }
                    if (variant === "full") {
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
                        assert.equal(await page.$$eval("main a", (links) => links.length), 0, "analytics-only interaction must not expose queue links");
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
