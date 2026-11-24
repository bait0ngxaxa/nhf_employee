import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { workspaceResponse } from "./workspace-header-responses.mjs";

const dashboard = [
    ["/dashboard/leave", "leave", "NHF Leave", true],
    ["/dashboard/stock", "stock", "NHF Stock", true],
    ["/dashboard/routine", "routine", "NHF Routine", true],
    ["/dashboard/it", "it-ticket", "บริการ IT", true],
    ["/dashboard/employees", "employee-management", "จัดการพนักงาน"],
    ["/dashboard/employees/new", "add-employee", "เพิ่มพนักงานใหม่"],
    ["/dashboard/employees/import", "import-employee", "นำเข้าข้อมูลพนักงานจาก CSV"],
    ["/dashboard/email-request", "email-request", "ส่งคำร้องพนักงานใหม่"],
    ["/dashboard/announcements", "announcements", "จัดการประกาศ"],
    ["/dashboard/authorization", "authorization-administration", "การจัดการสิทธิ์"],
    ["/dashboard/audit", "audit-logs", "บันทึกการใช้งาน"],
];
const liff = [
    ["/liff/stock", "stock", "บริการเบิกวัสดุ"],
    ["/liff/leave", "leave", "Leave"],
    ["/liff/routine", "routine", "งาน Routine ของฉัน"],
    ["/liff/it", "it-ticket", "คำขอ IT ของฉัน"],
];
const primaryImages = 'img[src^="/_next/static/media/"][src$=".svg"]:not([src$="-compact.svg"])';
const measuredRoutes = new Set(["leave", "stock", "routine", "employee-management", "add-employee", "import-employee", "email-request", "audit-logs"]);
const readyContent = {
    leave: "โควต้าวันลาของคุณ",
    stock: "ไม่พบวัสดุที่ค้นหา",
    routine: "ยังไม่มีรายการ Routine",
    "it-ticket": "#42 · เข้าใช้งานระบบไม่ได้",
    "employee-management": "ยังไม่มีข้อมูลพนักงาน",
    "authorization-administration": "ยังไม่มีทีม",
};

function measureHeader(artwork, { loading = false, grouped = false } = {}) {
    return artwork.evaluate((element, { loading, grouped }) => {
        const rect = (node) => {
            if (!node) return null;
            const { x, y, width, height } = node.getBoundingClientRect();
            return { x, y, width, height };
        };
        const slot = loading ? element : element.parentElement;
        const row = slot.parentElement;
        const header = grouped ? row.parentElement : row;
        return {
            header: rect(header),
            slot: rect(slot),
            text: rect(row.children[1]),
            title: rect(row.children[1].firstElementChild),
            action: rect(loading ? (grouped && row.nextElementSibling?.childElementCount ? row.nextElementSibling : null)
                : header.querySelector("button")),
            content: rect(header.nextElementSibling),
        };
    }, { loading, grouped });
}

export async function checkWorkspaceHeaders(browser, origin) {
    const screenshots = process.env.WORKSPACE_HEADER_SCREENSHOT_DIR;
    if (screenshots) await mkdir(screenshots, { recursive: true });
    const supportedWidths = [1440, 1024, 768, 390, 320];
    const widthArgument = process.argv[process.argv.indexOf("--workspace-headers") + 1];
    const widths = widthArgument === undefined ? supportedWidths : [Number(widthArgument)];
    assert.ok(widths.every((width) => supportedWidths.includes(width)), "Use a supported workspace viewport width");
    const unhandled = new Set();
    const measurements = [];
    let count = 0;
    for (const theme of ["light", "dark"]) {
        for (const width of widths) {
            const height = width >= 768 ? 900 : 850;
            const page = await browser.newPage({ viewport: { width, height }, colorScheme: theme });
            page.setDefaultTimeout(8_000);
            await page.addInitScript((mode) => {
                document.addEventListener("DOMContentLoaded", () => {
                    document.documentElement.classList.toggle("dark", mode === "dark");
                }, { once: true });
            }, theme);
            const errors = [];
            page.on("pageerror", (error) => errors.push(error.message));
            page.on("console", (message) => {
                if (message.type() === "error") errors.push(message.text());
            });
            page.on("response", (response) => {
                if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
            });
            page.on("requestfailed", (request) => {
                const error = request.failure()?.errorText;
                if (error !== "net::ERR_ABORTED") errors.push(`${error} ${request.url()}`);
            });
            let scenario;
            await page.route("**/api/**", async (route) => {
                const path = new URL(route.request().url()).pathname;
                const data = workspaceResponse(path, scenario);
                if (data === undefined) unhandled.add(path);
                await route.fulfill(data === undefined ? { status: 501, json: {} } : { json: data });
            });
            const capture = async (name) => {
                if (screenshots) await page.screenshot({ path: join(screenshots, `${width}-${name}-${theme}.png`), animations: "disabled" });
            };
            const open = async (path, state) => {
                scenario = state;
                await page.goto(origin + path);
            };
            const check = async (asset, title, pixels, dashboardHeading) => {
                const workspace = page.locator(dashboardHeading ? "main#main" : "main");
                const heading = workspace.getByRole("heading", { level: 1, name: title, exact: true });
                await heading.waitFor();
                assert.equal(await workspace.getByRole("heading", { level: 1 }).count(), 1, title);
                const images = page.locator(primaryImages);
                assert.equal(await images.count(), 1);
                const image = images.first();
                assert.equal(await image.getAttribute("src"), `/_next/static/media/${asset}.svg`);
                assert.equal(await image.getAttribute("alt"), "");
                const reservedArtwork = await image.boundingBox();
                await image.evaluate((element) => element.decode());
                const artwork = await image.boundingBox();
                assert.deepEqual(artwork, reservedArtwork, "Decoding preserves the reserved artwork slot");
                const text = await heading.boundingBox();
                assert.equal(artwork.width, pixels);
                assert.equal(artwork.height, pixels);
                assert.ok(text.x >= artwork.x + artwork.width && text.x + text.width <= width + 1,
                    `${width}px ${title} was clipped or overlapped the artwork`);
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
                if (dashboardHeading) {
                    assert.equal(await heading.getAttribute("tabindex"), "-1");
                    assert.notEqual(await heading.getAttribute("data-page-heading"), null);
                } else {
                    await page.getByRole("link", { name: "ไปหน้าหลัก NHFapp" }).locator("img").waitFor();
                }
                count++;
                return { heading, image };
            };
            try {
                const destinations = width === 1440 ? dashboard
                    : dashboard.filter(([, asset]) => ["routine", "leave", "employee-management", "import-employee", "authorization-administration"].includes(asset));
                for (const [path, asset, title, core] of destinations) {
                    await open(path);
                    const { heading } = await check(asset, title, core ? (width >= 1024 ? 64 : 48) : (width >= 640 ? 48 : 32), true);
                    if (asset === "routine") {
                        const action = page.getByRole("button", { name: "ส่งออก Excel รายการทั้งหมด" });
                        const bounds = await action.boundingBox();
                        assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
                    }
                    if (asset === "import-employee") await page.getByRole("button", { name: "กลับไปรายชื่อ" }).waitFor();
                    if (asset === "authorization-administration") await page.getByRole("button", { name: "โหลดข้อมูลล่าสุด" }).waitFor();
                    if (readyContent[asset]) {
                        await page.locator("main").getByText(readyContent[asset], { exact: true }).first().waitFor();
                        assert.equal(await page.locator("main").getByRole("alert").count(), 0);
                    }
                    await heading.focus();
                    assert.equal(await heading.evaluate((element) => element === document.activeElement), true);
                    await heading.evaluate((element) => element.blur());
                    await capture(`dashboard-${asset}`);
                }
                for (const [path, asset, title, core] of dashboard.filter(([, id]) => measuredRoutes.has(id))) {
                    const grouped = !["email-request", "audit-logs"].includes(asset);
                    const pixels = core ? (width >= 1024 ? 64 : 48) : (width >= 640 ? 48 : 32);
                    await open(`${path}?fixture=loading`);
                    const loading = page.locator('main [role="status"][aria-busy="true"]').first();
                    const placeholder = loading.locator('[data-slot="skeleton"]').first();
                    await placeholder.waitFor();
                    await page.evaluate(() => document.fonts.ready);
                    const before = await measureHeader(placeholder, { loading: true, grouped });
                    await page.evaluate((pathname) => {
                        history.replaceState(null, "", pathname);
                        dispatchEvent(new PopStateEvent("popstate"));
                    }, path);
                    const { image } = await check(asset, title, pixels, true);
                    const ready = await measureHeader(image, { grouped: true });
                    assert.equal(before.slot.width, ready.slot.width, `${asset} placeholder width`);
                    assert.equal(before.slot.height, ready.slot.height, `${asset} placeholder height`);
                    assert.ok(Math.abs(before.text.x - ready.text.x) <= 1, `${asset} horizontal heading anchor`);
                    if (asset === "stock") {
                        // Short one-line subtitle and no actions in either state.
                        assert.ok(Math.abs(before.content.y - ready.content.y) <= 1, "Stock content starts at the same position");
                    }
                    if (asset === "employee-management" && width <= 390) {
                        // Two full-width actions account for the same space; border and text metrics may differ.
                        assert.ok(Math.abs(before.content.y - ready.content.y) <= 8, "Employee action placeholders match the loaded row count");
                    }
                    if (asset === "employee-management" && width >= 1024) {
                        assert.ok(Math.abs(before.slot.y - ready.slot.y) <= 2, "Employee placeholder actions stay on one desktop row");
                    }
                    measurements.push({ width, theme, asset, loading: before, ready });
                }
                if (width === 390 || width === 320) {
                    for (const [path, asset, title] of liff) {
                        await open(path);
                        await check(asset, title, 32, false);
                        if (asset === "stock") {
                            await page.getByRole("heading", { level: 2, name: "เลือกวัสดุที่ต้องการเบิก" }).waitFor();
                            await page.getByRole("heading", { name: "กระดาษถ่ายเอกสาร" }).waitFor();
                        }
                        if (asset === "it-ticket") await page.getByRole("link", { name: /เข้าใช้งานระบบไม่ได้/ }).waitFor();
                        await capture(`liff-${asset}`);
                    }
                }
                if (width === 390) {
                    await open("/dashboard/employees?fixture=restricted");
                    await check("employee-management", "ข้อมูลพนักงาน", 32, true);
                    assert.equal(await page.getByRole("button", { name: "เพิ่มพนักงาน", exact: true }).count(), 0);
                    assert.equal(await page.getByRole("button", { name: "นำเข้า CSV", exact: true }).count(), 0);
                    await capture("dashboard-employees-read-only");

                    await open("/dashboard/routine?fixture=restricted");
                    const { image, heading } = await check("routine", "NHF Routine", 48, true);
                    assert.equal(await page.getByRole("button", { name: "ส่งออก Excel รายการทั้งหมด" }).count(), 0);
                    const before = await heading.boundingBox();
                    await image.dispatchEvent("error");
                    const dashboardFallback = page.locator("main .lucide-clipboard-check[aria-hidden=true]");
                    await dashboardFallback.waitFor();
                    assert.equal((await dashboardFallback.boundingBox()).width, 24);
                    assert.deepEqual(await heading.boundingBox(), before);
                    await capture("dashboard-routine-fallback");

                    await open("/dashboard/leave?fixture=unavailable");
                    await check("leave", "NHF Leave", 48, true);
                    await page.locator("main#main").getByText("ยังไม่พร้อมให้บริการ", { exact: true }).waitFor();
                    await capture("dashboard-leave-unavailable");

                    await open("/dashboard/leave?fixture=loading");
                    await page.getByRole("status", { name: "กำลังโหลดหน้าจัดการวันลา" }).waitFor();
                    await capture("dashboard-leave-loading");
                    await page.evaluate(() => {
                        history.replaceState(null, "", "/dashboard/leave");
                        dispatchEvent(new PopStateEvent("popstate"));
                    });
                    await check("leave", "NHF Leave", 48, true);

                    await open("/liff/leave", "approvals");
                    await check("leave", "Leave", 32, false);
                    await capture("liff-leave-approvals");
                    await open("/liff/stock?requestId=42");
                    await page.getByRole("dialog").getByText("กระดาษถ่ายเอกสาร", { exact: true }).waitFor();
                    assert.equal(await page.getByRole("dialog").locator(primaryImages).count(), 0);
                    await capture("liff-stock-request");
                    await open("/liff/routine", "restricted");
                    await page.getByText(/บัญชีนี้/).first().waitFor();
                    assert.equal(await page.locator(primaryImages).count(), 0);
                    await capture("liff-routine-unavailable");

                    const homeReady = Promise.withResolvers();
                    await page.route("**/api/line/home", async (route) => {
                        await homeReady.promise;
                        await route.fulfill({ json: workspaceResponse("/api/line/home") });
                    }, { times: 1 });
                    try {
                        await open("/liff/routine");
                        await page.getByText("กำลังโหลดงาน Routine…", { exact: true }).waitFor();
                        await capture("liff-routine-loading");
                    } finally {
                        homeReady.resolve();
                    }
                    const routine = await check("routine", "งาน Routine ของฉัน", 32, false);
                    const routinePosition = await routine.heading.boundingBox();
                    await routine.image.dispatchEvent("error");
                    const liffFallback = page.locator("main .lucide-clipboard-check[aria-hidden=true]");
                    await liffFallback.waitFor();
                    assert.equal((await liffFallback.boundingBox()).width, 20);
                    assert.deepEqual(await routine.heading.boundingBox(), routinePosition);
                    await capture("liff-routine-fallback");
                    await open("/liff/it");
                    await page.getByRole("button", { name: "แจ้งปัญหา / ขอความช่วยเหลือ" }).click();
                    await page.getByRole("heading", { name: "แจ้งปัญหา / ขอความช่วยเหลือ" }).waitFor();
                    assert.equal(await page.locator(primaryImages).count(), 0);
                    await capture("liff-it-create");
                    await open("/liff/it/42");
                    await page.getByRole("heading", { level: 1, name: "เข้าใช้งานระบบไม่ได้" }).waitFor();
                    const itTab = page.getByRole("navigation").getByRole("link", { name: "IT", exact: true });
                    assert.equal(await itTab.getAttribute("aria-current"), "page");
                    assert.equal(await page.locator(primaryImages).count(), 0);
                    await capture("liff-it-detail");
                    count += 6;
                }
                if (width === 1440) {
                    await open("/dashboard/it");
                    for (const name of ["คิวงาน IT", "รายงาน"]) {
                        await page.getByRole("tab", { name, exact: true }).click();
                        if (name === "รายงาน") {
                            await page.getByRole("tab", { name, exact: true, selected: true }).waitFor();
                            const report = page.getByRole("tabpanel", { name, exact: true });
                            const overview = report.getByRole("region", { name: "ภาพรวม", exact: true });
                            const error = report.getByRole("alert");
                            await overview.or(error).waitFor();
                            assert.equal(await error.isVisible(), false,
                                `IT Analytics must reach ready state: ${await error.allTextContents()}`);
                            assert.equal(await report.getByRole("status", { name: "กำลังโหลดรายงาน IT" }).isVisible(), false);
                            await overview.getByText("งานค้างปัจจุบัน", { exact: true }).waitFor();
                        }
                        await check("it-ticket", "บริการ IT", 64, true);
                        await capture(name === "รายงาน" ? "dashboard-it-analytics" : "dashboard-it-queue");
                    }
                }
                assert.deepEqual(errors, [], `${width}px ${theme}: browser errors`);
            } catch (error) {
                throw new Error(`${page.url()} at ${width}px ${theme}: ${errors.join("\n")}\nUnhandled requests: ${[...unhandled].join(", ")}`, { cause: error });
            } finally {
                await page.close();
            }
        }
    }
    assert.deepEqual([...unhandled].sort(), [], "Workspace fixture is missing API responses");
    if (process.env.WORKSPACE_HEADER_MEASUREMENTS_PATH) {
        await writeFile(process.env.WORKSPACE_HEADER_MEASUREMENTS_PATH, JSON.stringify(measurements, null, 2) + "\n");
    }
    process.stdout.write(`Workspace header checks passed: ${count} cases (Chromium component fixture).\n`);
}
