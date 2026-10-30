import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import puppeteer from "puppeteer";

// Same installed browser toolchain as check-it-analytics-chart.mjs; no Next server or database.
const output = await mkdtemp(join(tmpdir(), "nhf-announcement-smoke-"));
await build({
    stdin: {
        contents: `import React from "react";
            import { createRoot } from "react-dom/client";
            import { AnnouncementTicker } from "./modules/announcements/presentation/AnnouncementTicker";
            import { AnnouncementManager } from "./modules/announcements/presentation/AnnouncementManager";
            import { DashboardHomeSection } from "./components/dashboard/sections/DashboardHomeSection";
            const long = new URLSearchParams(location.search).has("long");
            const view = new URLSearchParams(location.search).get("view");
            const content = long ? "ประกาศองค์กร NHF ".repeat(30) : "ประชุมพนักงานวันศุกร์ เวลา 09:00 น.";
            const ticker = <AnnouncementTicker content={content} />;
            createRoot(document.getElementById("root")).render(
                <main className="mx-auto max-w-7xl p-4">{view === "manager"
                    ? <AnnouncementManager initialState={{ content, published: true, version: 1, authorId: 7, updatedById: 7, createdAt: "2026-10-30T00:00:00Z", updatedAt: "2026-10-30T00:00:00Z" }} />
                    : view === "home" ? <DashboardHomeSection announcement={ticker} /> : ticker}</main>);`,
        resolveDir: process.cwd(), loader: "tsx",
    },
    bundle: true, jsx: "automatic", outfile: join(output, "ticker.js"),
    plugins: [{ name: "isolated-presentation-context", setup(builder) {
        const stubs = {
            "next/navigation": 'export const useRouter = () => ({ refresh() {} });',
            "next/dynamic": 'import React from "react"; export default () => () => React.createElement("span", null, "สวัสดี");',
            "@/components/dashboard/context/dashboard/DashboardContext": 'export const useDashboardDataContext = () => ({ user: { name: "พนักงาน NHF", department: "ฝ่ายทั่วไป", teams: [] }, availableMenuGroups: [] }); export const useDashboardUIContext = () => ({ handleMenuClick() {} });',
            "@/components/dashboard/line/LineAddFriendCard": 'export const LineAddFriendCard = () => null;',
        };
        builder.onResolve({ filter: /^(next\/navigation|next\/dynamic|@\/components\/dashboard\/)/ }, (args) =>
            args.path in stubs ? { path: args.path, namespace: "preview-context" } : undefined);
        builder.onResolve({ filter: /^\.\/api$/ }, (args) => args.importer.endsWith("AnnouncementManager.tsx")
            ? { path: "manager-api", namespace: "preview-context" } : undefined);
        builder.onLoad({ filter: /.*/, namespace: "preview-context" }, (args) => ({
            contents: args.path === "manager-api"
                ? 'export const saveAnnouncement = async () => { throw new Error("มีผู้ดูแลแก้ไขประกาศแล้ว ข้อความที่คุณพิมพ์ยังอยู่ กรุณาคัดลอกไว้แล้วกดโหลดข้อมูลล่าสุดก่อนแก้ไขอีกครั้ง"); }; export const loadManagedAnnouncement = async () => { throw new Error("Preview only"); };'
                : stubs[args.path], resolveDir: process.cwd(),
        }));
    } }],
});
const globalCss = await postcss([tailwind()]).process(await readFile("app/globals.css", "utf8"), {
    from: resolve("app/globals.css"),
});
const tickerCss = await readFile(join(output, "ticker.css"), "utf8");
// Reuse the actual next/font output when present; otherwise fetch the same font family.
let fontCss = "";
try {
    for (const file of await readdir(".next/static/chunks")) {
        if (!file.endsWith(".css")) continue;
        const css = await readFile(join(".next/static/chunks", file), "utf8");
        if (css.startsWith("@font-face{font-family:Noto Sans Thai;")) { fontCss = css; break; }
    }
} catch { /* No prior Next output; use the configured Google font below. */ }
if (!fontCss) {
    const response = await fetch("https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@100..900&display=swap");
    assert.ok(response.ok, "Noto Sans Thai stylesheet must be available for visual checks");
    fontCss = await response.text();
}
for (const match of fontCss.matchAll(/url\(([^)]+)\)/g)) {
    const source = match[1];
    const bytes = source.startsWith("../media/") ? await readFile(join(".next/static/media", source.slice(9)))
        : Buffer.from(await (await fetch(source)).arrayBuffer());
    fontCss = fontCss.replace(match[0], `url(data:font/woff2;base64,${bytes.toString("base64")})`);
}
await writeFile(join(output, "index.html"), `<!doctype html><html lang="th"><meta charset="utf-8">
    <style>${fontCss}\n${globalCss.css}\n${tickerCss}\n:root { --font-noto-sans-thai: "Noto Sans Thai", sans-serif; }</style><body><div id="root"></div><script src="ticker.js"></script></body></html>`, "utf8");
const browser = await puppeteer.launch({ executablePath: process.env.CHART_BROWSER_PATH || undefined, headless: true });
let cases = 0;
try {
    for (const width of [320, 390, 768, 1280]) {
        for (const long of [false, true]) {
            for (const reduced of [false, true]) {
                const page = await browser.newPage();
                const errors = [];
                page.on("pageerror", (error) => errors.push(String(error)));
                await page.setViewport({ width, height: 900 });
                await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: reduced ? "reduce" : "no-preference" }]);
                await page.goto(`${pathToFileURL(join(output, "index.html"))}${long ? "?long" : ""}`);
                await page.waitForSelector('section[aria-label="ประกาศ"]');
                await page.evaluate(() => document.fonts.ready);
                if (long && [320, 1280].includes(width)) {
                    await page.screenshot({ path: join(output, `ticker-${width}-${reduced ? "static" : "moving"}.png`), fullPage: true });
                }
                const metrics = await page.evaluate(() => {
                    const region = document.querySelector("section");
                    const track = region.querySelector("p").parentElement;
                    const items = track.querySelectorAll("p");
                    return {
                        overflow: document.documentElement.scrollWidth > innerWidth,
                        animation: getComputedStyle(track).animationName,
                        wrap: getComputedStyle(items[0]).whiteSpace,
                        duplicate: getComputedStyle(items[1]).display,
                        textHeight: items[0].getBoundingClientRect().height,
                    };
                });
                assert.equal(metrics.overflow, false, `${width}px: no page overflow`);
                if (reduced) {
                    assert.equal(metrics.animation, "none"); assert.equal(metrics.wrap, "pre-wrap");
                    assert.equal(metrics.duplicate, "none");
                    if (long && width === 320) assert.ok(metrics.textHeight > 100, "long mobile text wraps in reduced motion");
                } else {
                    assert.notEqual(metrics.animation, "none");
                    await page.hover('[aria-label="ข้อความประกาศ"]');
                    assert.equal(await page.$eval("section p", (p) => getComputedStyle(p.parentElement).animationPlayState), "paused");
                    await page.mouse.move(0, 0);
                    await page.focus('[aria-label="ข้อความประกาศ"]');
                    assert.equal(await page.$eval("section p", (p) => getComputedStyle(p.parentElement).animationPlayState), "paused");
                    await page.focus("section button");
                    await page.keyboard.press("Enter");
                    assert.equal(await page.$eval("section", (s) => s.dataset.paused), "true");
                    const paused = await page.$eval("section p", (p) => ({ animation: getComputedStyle(p.parentElement).animationName,
                        wrap: getComputedStyle(p).whiteSpace, overflow: p.scrollWidth > p.clientWidth + 1 }));
                    assert.equal(paused.animation, "none"); assert.equal(paused.wrap, "pre-wrap"); assert.equal(paused.overflow, false);
                    await page.keyboard.press("Enter");
                    assert.equal(await page.$eval("section", (s) => s.dataset.paused), "false");
                    assert.equal(await page.$eval("section button", (button) => document.activeElement === button), true);
                    await page.hover("section button");
                    assert.equal(await page.$eval("section p", (p) => getComputedStyle(p.parentElement).animationPlayState), "running",
                        "keyboard Resume must restart animation while the button retains focus");
                    const position = await page.$eval("section p", (p) => p.getBoundingClientRect().x);
                    await page.waitForFunction((previous) => document.querySelector("section p").getBoundingClientRect().x < previous - 1, {}, position);
                }
                if (long && [320, 1280].includes(width) && reduced) {
                    await page.screenshot({ path: join(output, `ticker-${width}.png`), fullPage: true });
                    await page.evaluate(() => document.documentElement.classList.add("dark"));
                    await page.evaluate(() => new Promise((done) => setTimeout(done, 300)));
                    await page.screenshot({ path: join(output, `ticker-${width}-dark.png`), fullPage: true });
                }
                const contrast = await page.evaluate(() => {
                    const section = document.querySelector("section");
                    const context = document.createElement("canvas").getContext("2d");
                    function luminance(color) {
                        context.clearRect(0, 0, 1, 1);
                        context.fillStyle = color; context.fillRect(0, 0, 1, 1);
                        const channels = [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map((value) => {
                            const s = value / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
                        });
                        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
                    }
                    const background = luminance(getComputedStyle(section).backgroundColor);
                    return ["h2", "p", "button"].map((selector) => {
                        const foreground = luminance(getComputedStyle(section.querySelector(selector)).color);
                        return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
                    });
                });
                assert.ok(contrast.every((ratio) => ratio >= 4.5), `announcement text contrast: ${contrast}`);
                assert.deepEqual(errors, []);
                cases += 1;
                await page.close();
            }
        }
    }
    // Capture real manager and dashboard composition; transport/context are isolated, not a live session.
    for (const width of [320, 1280]) {
        for (const view of ["manager", "home"]) {
            const page = await browser.newPage();
            await page.setViewport({ width, height: 900 });
            await page.goto(`${pathToFileURL(join(output, "index.html"))}?view=${view}`);
            await page.waitForSelector(view === "manager" ? "textarea" : "#dashboard-home-heading");
            await page.evaluate(() => document.fonts.ready);
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
            if (view === "home") {
                const placed = await page.evaluate(() => document.querySelector('[aria-label="ประกาศ"]').getBoundingClientRect().bottom
                    <= document.querySelector("#dashboard-home-heading").getBoundingClientRect().top);
                assert.equal(placed, true, "ticker appears above dashboard greeting");
            }
            await page.screenshot({ path: join(output, `${view}-${width}.png`), fullPage: true });
            if (view === "manager") {
                await page.evaluate(() => Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "บันทึกและเผยแพร่").click());
                await page.waitForSelector('[role="alert"]');
                await page.evaluate(() => Array.from(document.querySelectorAll("button")).find((b) => b.textContent === "โหลดข้อมูลล่าสุด").click());
                await page.waitForFunction(() => document.body.textContent.includes("ยืนยันโหลดใหม่"));
                await page.screenshot({ path: join(output, `manager-conflict-${width}.png`), fullPage: true });
            }
            await page.close();
        }
    }
    process.stdout.write(`Announcement browser checks passed: ${cases} cases (width, content length, reduced motion). Screenshots: ${output}\n`);
} finally {
    await browser.close();
}
