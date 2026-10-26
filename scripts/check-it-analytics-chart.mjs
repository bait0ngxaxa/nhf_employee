import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import puppeteer from "puppeteer";

// Render the real component and project CSS, without starting Next or connecting to an API.
// esbuild/PostCSS/Puppeteer are already installed by the locked development toolchain.
const output = await mkdtemp(join(tmpdir(), "nhf-chart-smoke-"));
const bundle = await build({
    stdin: {
        contents: `import React from "react";
            import { createRoot } from "react-dom/client";
            import { ITAnalyticsTrendChart } from "./modules/it/presentation/dashboard/ITAnalyticsTrendChart";
            const period = new URLSearchParams(location.search).get("period") || "30D";
            const trend = Array.from({ length: parseInt(period) }, (_, index) => ({
                date: new Date(Date.UTC(2026, 9, 27 - parseInt(period) + index)).toISOString().slice(0, 10),
                created: index % 9, resolved: index % 7,
            }));
            createRoot(document.getElementById("root")).render(
                <main className="mx-auto max-w-7xl p-4"><ITAnalyticsTrendChart period={period} trend={trend} /></main>
            );`,
        resolveDir: process.cwd(), loader: "tsx",
    },
    bundle: true, write: false, jsx: "automatic",
});
const css = await postcss([tailwind()]).process(await readFile("app/globals.css", "utf8"), {
    from: resolve("app/globals.css"),
});
await writeFile(join(output, "chart.js"), bundle.outputFiles[0].contents);
await writeFile(join(output, "index.html"), `<!doctype html><html lang="th"><meta charset="utf-8">
    <style>${css.css}</style><body><div id="root"></div><script src="chart.js"></script></body></html>`, "utf8");

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
        for (const period of ["7D", "30D", "90D"]) {
            for (const dark of [false, true]) {
                const page = await browser.newPage();
                page.setDefaultTimeout(4000);
                const key = `${width}px ${period} ${dark ? "dark" : "light"}`;
                const errors = [];
                let action = "layout";
                page.on("pageerror", (error) => errors.push(String(error)));
                try {
                    await page.setViewport({ width, height: 900, hasTouch: true });
                    await page.goto(`${pathToFileURL(join(output, "index.html"))}?period=${period}`);
                    if (dark) await page.evaluate(() => document.documentElement.classList.add("dark"));
                    await page.waitForSelector(".recharts-bar");
                    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
                    const layout = await page.evaluate(() => {
                        const region = document.querySelector('[role="region"]');
                        return {
                            overflow: document.documentElement.scrollWidth > innerWidth,
                            height: document.querySelector('[data-slot="chart"]').getBoundingClientRect().height,
                            scrollable: region.scrollWidth > region.clientWidth + 1,
                        };
                    });
                    assert.equal(layout.overflow, false, "page must not overflow horizontally");
                    assert.ok(layout.height > 0, "chart must have measurable height");
                    if (width === 1280 && period === "90D") {
                        assert.equal(layout.scrollable, false, "weekly desktop chart must fit its region");
                    }
                    if (width <= 390 && period !== "7D") {
                        assert.ok(layout.scrollable, "mobile chart must retain readable scrollable buckets");
                    }
                    // Real browser keyboard events, not jsdom's mocked ResizeObserver.
                    action = "keyboard";
                    await page.$eval('[role="application"]', (element) => element.focus());
                    await page.waitForSelector('[role="tooltip"]', { visible: true });
                    const first = await page.$eval('[role="tooltip"]', (element) => element.textContent);
                    await page.keyboard.press("ArrowRight");
                    await page.waitForFunction((text) => {
                        const tooltip = document.querySelector('[role="tooltip"]');
                        return tooltip && tooltip.textContent !== text;
                    }, {}, first);
                    await page.keyboard.press("Tab");
                    await page.mouse.move(0, 0);
                    const rect = await page.$eval('[role="region"]', (element) => {
                        const box = element.getBoundingClientRect();
                        element.scrollLeft = 0;
                        return { x: box.x, y: box.y, width: box.width };
                    });
                    if (layout.scrollable) {
                        action = "touch scroll";
                        await page.touchscreen.touchStart(rect.x + rect.width - 20, rect.y + 180);
                        for (let step = 1; step <= 8; step += 1) {
                            await page.touchscreen.touchMove(rect.x + rect.width - 20 - step * (rect.width - 60) / 8, rect.y + 180);
                        }
                        await page.touchscreen.touchEnd();
                        await page.waitForFunction(() => document.querySelector('[role="region"]').scrollLeft > 0);
                        // A tap during native momentum scrolling stops the scroll rather than selecting a bar.
                        await page.evaluate(() => new Promise((done, reject) => {
                            const region = document.querySelector('[role="region"]');
                            let previous = region.scrollLeft;
                            let stableFrames = 0;
                            let frames = 0;
                            const check = () => {
                                stableFrames = Math.abs(region.scrollLeft - previous) < 1 ? stableFrames + 1 : 0;
                                previous = region.scrollLeft;
                                frames += 1;
                                if (stableFrames >= 6) done();
                                else if (frames >= 180) reject(new Error("Touch scroll did not settle"));
                                else requestAnimationFrame(check);
                            };
                            requestAnimationFrame(check);
                        }));
                    }
                    action = "touch tap";
                    await page.touchscreen.tap(rect.x + rect.width / 3, rect.y + 120);
                    await page.waitForSelector('[role="tooltip"]', { visible: true });
                    const tapped = await page.$eval('[role="tooltip"]', (element) => element.textContent);
                    await page.touchscreen.tap(rect.x + rect.width * 2 / 3, rect.y + 120);
                    await page.waitForFunction((text) => {
                        const tooltip = document.querySelector('[role="tooltip"]');
                        return tooltip && tooltip.textContent !== text;
                    }, {}, tapped);
                    const tooltip = await page.$eval('[role="tooltip"]', (element) => {
                        const box = element.getBoundingClientRect();
                        const region = document.querySelector('[role="region"]').getBoundingClientRect();
                        return { text: element.textContent, visible: box.left >= 0 && box.right <= innerWidth,
                            belowPlot: box.top >= region.bottom };
                    });
                    assert.ok(tooltip.visible, "selected values must remain inside the viewport after touch scrolling");
                    assert.ok(tooltip.belowPlot, "fixed readout must not overlap the plot");
                    assert.match(tooltip.text, /Ticket ใหม่/);
                    assert.match(tooltip.text, /แก้ไขแล้ว/);
                    await page.screenshot({ path: join(output, `${width}-${period}-${dark ? "dark" : "light"}.png`) });
                    action = "mouse hover after touch";
                    await page.mouse.move(rect.x + rect.width / 3, rect.y + 160);
                    await page.waitForSelector('[role="tooltip"]', { visible: true });
                    await page.mouse.move(0, 0);
                    await page.waitForSelector('[role="tooltip"]', { hidden: true });
                    assert.deepEqual(errors, [], "browser must not report runtime errors");
                    cases += 1;
                } catch (error) {
                    failures.push(`${key} (${action}): ${error.message}`);
                } finally {
                    await page.close();
                    process.stdout.write(`Checked ${key}\n`);
                }
            }
        }
    }
} finally {
    await browser.close();
}
process.stdout.write(`${JSON.stringify({ passed: cases, failures, artifacts: output }, null, 2)}\n`);
if (failures.length > 0) process.exitCode = 1;
