import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

// Real components + project CSS; fixture identity, API status and App Router adapters.
// This checks rendered layout/interactions, not authentication, RSC or real-device E2E.
const output = await mkdtemp(join(tmpdir(), "nhf-mobile-navigation-"));
const screenshots = process.env.MOBILE_NAV_SCREENSHOT_DIR;
const menuScreenshots = process.env.MENU_IDENTITY_SCREENSHOT_DIR;
if (screenshots) await mkdir(screenshots, { recursive: true });
if (menuScreenshots) await mkdir(menuScreenshots, { recursive: true });
const bundle = await build({
    stdin: {
        resolveDir: process.cwd(), loader: "tsx",
        contents: `import React, { useState, useSyncExternalStore } from "react";
            import { createRoot } from "react-dom/client";
            import { DashboardDataContext, DashboardUIContext } from "./components/dashboard/context/dashboard/DashboardContext";
            import { DashboardLayoutClient } from "./components/dashboard/layout/DashboardLayoutClient";
            import { DashboardHomeSection } from "./components/dashboard/sections/DashboardHomeSection";
            import { DashboardMoreSection } from "./components/dashboard/sections/DashboardMoreSection";
            import { AnnouncementTicker } from "./modules/announcements/presentation/AnnouncementTicker";
            import { LiffAppShell } from "./components/liff/LiffAppShell";
            import { LiffHomeApp } from "./components/liff/home/LiffHomeApp";
            import { DASHBOARD_MENU_GROUPS, DASHBOARD_MENU_ITEMS, getAvailableMenuGroups } from "./constants/dashboard";
            import { getDashboardMenuIdFromPathname, toDashboardMenuPath } from "./lib/ssot/routes";
            import { usePathname, useRouter } from "next/navigation";
            function Fixture() {
                const pathname = usePathname(); const router = useRouter();
                const [collapsed, setCollapsed] = useState(false);
                const [signedOut, setSignedOut] = useState(false);
                const variant = new URLSearchParams(location.search).get("fixture");
                const isAdmin = variant !== "menu-restricted";
                const employeeCapabilities = {
                    canReadEmployees: isAdmin, canCreateEmployees: isAdmin,
                    canImportEmployees: isAdmin && variant !== "menu-no-import",
                };
                const administrativeGroups = getAvailableMenuGroups(
                    isAdmin, undefined, undefined, undefined, employeeCapabilities,
                    { canReadAuditLogs: isAdmin }, { canReadRequests: isAdmin },
                ).filter(group => group.id !== "internal-services");
                let groups = [DASHBOARD_MENU_GROUPS[0], ...administrativeGroups];
                if (variant === "one") groups = [{ ...groups[0], items: groups[0].items.filter(i => i.id === "stock") }];
                if (variant === "none") groups = [];
                if (variant === "limited") groups = [{ ...groups[0], items: groups[0].items.filter(i => ["stock", "routine"].includes(i.id)) }];
                if (variant === "admin-only") groups = groups.slice(1);
                if (variant === "unavailable") groups = groups.map(g => ({ ...g, items: g.items.map(i => i.id === "leave-management" ? { ...i, unavailable: true } : i) }));
                if (variant === "disabled") groups = getAvailableMenuGroups(false);
                if (variant === "long") groups = groups.map(g => ({ ...g, items: g.items.map(i => i.id === "routine" ? { ...i, label: "บริการพนักงานและผู้ดูแลระบบที่มีชื่อภาษาไทยยาวมาก" } : i) }));
                if (variant === "menu-states") groups = groups.map(g => ({ ...g, items: g.items.map(i =>
                    i.id === "leave-management" ? { ...i, unavailable: true } : i.id === "add-employee" ? { ...i, comingSoon: true } : i
                ) }));
                if (variant === "menu-import-projected") groups = [...groups, {
                    id: "employee-import", label: "นำเข้าข้อมูล",
                    items: [DASHBOARD_MENU_ITEMS.find(item => item.id === "import-employee")],
                }];
                const user = { id: "fixture", name: "พนักงาน ทดสอบ", email: "fixture@example.test", role: isAdmin ? "ADMIN" : "USER", teams: [{ id: 1, name: "NHF" }], department: "NHF", employeeCapabilities };
                const ui = { selectedMenu: getDashboardMenuIdFromPathname(pathname), mobileNavOpen: false, setMobileNavOpen() {}, desktopSidebarCollapsed: collapsed, setDesktopSidebarCollapsed: setCollapsed, router, handleMenuClick: id => router.push(toDashboardMenuPath(id)), handleSignOut: async () => setSignedOut(true) };
                if (pathname === "/liff") return <LiffAppShell><LiffHomeApp /></LiffAppShell>;
                if (pathname.startsWith("/liff")) return <LiffAppShell><main id="main" className="p-4"><h1>บริการผ่าน LINE</h1><div style={{height: "100vh"}}>เนื้อหาทดสอบ</div></main></LiffAppShell>;
                return <DashboardDataContext.Provider value={{status: "authenticated", user, isAdmin, availableMenuGroups: groups}}><DashboardUIContext.Provider value={ui}><DashboardLayoutClient>{signedOut ? <h1>ออกจากระบบแล้ว (fixture)</h1> : pathname === "/dashboard/more" ? <DashboardMoreSection /> : pathname === "/dashboard" ? <DashboardHomeSection announcement={<AnnouncementTicker content={variant === "no-announcement" ? null : "ประกาศสำหรับพนักงาน NHF — ตรวจสอบข่าวสารก่อนเริ่มงาน"} />} /> : <section><h1 data-page-heading tabIndex={-1}>บริการทดสอบ</h1><form data-navigation-dirty="true"><textarea aria-label="ข้อความที่ยังไม่ได้บันทึก" defaultValue="ร่างข้อความ" /></form><div style={{ height: "110vh" }} /><div className="dashboard-floating-action fixed bottom-[calc(var(--dashboard-mobile-nav-height,0px)+1rem+env(safe-area-inset-bottom))] right-4 z-30"><button className="min-h-11 rounded-md bg-brand-solid p-3">บันทึก</button></div></section>}</DashboardLayoutClient></DashboardUIContext.Provider></DashboardDataContext.Provider>;
            }
            createRoot(document.getElementById("root")).render(<Fixture />);`,
    },
    outfile: join(output, "fixture.js"), bundle: true, write: false, format: "iife", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_FEATURE_LEAVE": '"false"', "process.env.NEXT_PUBLIC_FEATURE_ROUTINE": '"false"' },
    loader: { ".png": "dataurl", ".svg": "file" },
    assetNames: "_next/static/media/[name]",
    publicPath: "/",
    plugins: [{ name: "fixture-boundaries", setup(context) {
        context.onResolve({ filter: /^next\/(navigation|link|image|dynamic)$/ }, ({ path }) => ({ path, namespace: "fixture" }));
        context.onResolve({ filter: /^@\/components\/dashboard\/context$/ }, () => ({ path: resolve("components/dashboard/context/dashboard/DashboardContext.tsx") }));
        context.onResolve({ filter: /^@\/modules\/notification\/client$/ }, () => ({ path: "notifications", namespace: "fixture" }));
        context.onResolve({ filter: /^@\/modules\/line\/client$/ }, ({ importer }) =>
            importer === resolve("components/liff/home/LiffHomeApp.tsx") ? { path: "line", namespace: "fixture" } : undefined);
        context.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => {
            const common = `import React, { useMemo, useState, useEffect, useSyncExternalStore } from "react";`;
            const sources = {
                "next/navigation": `${common}
                    const subscribe = cb => { addEventListener("popstate", cb); return () => removeEventListener("popstate", cb); };
                    const get = () => location.pathname + location.search;
                    const navigate = (method, href) => { history[method](null, "", href); dispatchEvent(new PopStateEvent("popstate")); };
                    const router = { push: href => navigate("pushState", href), replace: href => navigate("replaceState", href), refresh() {} };
                    export const useRouter = () => router;
                    export const usePathname = () => { useSyncExternalStore(subscribe, get); return location.pathname; };
                    export const useSearchParams = () => { const route = useSyncExternalStore(subscribe, get); return useMemo(() => new URLSearchParams(location.search), [route]); };`,
                "next/link": `${common} export const useLinkStatus = () => ({pending:false}); export default function Link({href, children, onNavigate, prefetch, scroll, ...props}) { return <a {...props} href={href} onClick={event => { if(event.metaKey || event.ctrlKey) return; event.preventDefault(); let blocked = false; onNavigate?.({preventDefault: () => blocked = true}); if(!blocked) { history.pushState(null, "", href); dispatchEvent(new PopStateEvent("popstate")); } }}>{children}</a>; }`,
                "next/image": `${common} export default function Image({src, priority, fill, quality, unoptimized, ...props}) { return <img {...props} src={typeof src === "string" ? src : src.src} />; }`,
                "next/dynamic": `${common} export default function dynamic(load, options) { return function Dynamic(props) { const [Component, setComponent] = useState(null); useEffect(() => { load().then(module => setComponent(() => module.default)); }, []); return Component ? <Component {...props} /> : options?.loading?.() ?? null; }; }`,
                notifications: `${common} export function NotificationDropdown() { return <button>การแจ้งเตือน</button>; }`,
                line: `export class LiffApiError extends Error {}
                    const workforce = { userId: 10, employeeId: 20, name: "พนักงาน ทดสอบ" };
                    export const useLiffWorkforce = () => workforce;
                    export async function fetchLiffHome() {
                        const disabled = new URLSearchParams(location.search).has("fixture");
                        const available = { enabled: true, status: "available" };
                        return { workforce, modules: {
                            stock: available, routine: available,
                            leave: disabled ? { enabled: false, status: "unavailable" } : available,
                            it: disabled ? { enabled: false, status: "coming-soon" } : available,
                        } };
                    }`,
            };
            return { contents: sources[path], loader: "tsx", resolveDir: process.cwd() };
        });
    } }],
});
const css = await postcss([tailwind()]).process(await readFile("app/globals.css", "utf8"), { from: resolve("app/globals.css") });
await writeFile(join(output, "fixture.js"), bundle.outputFiles.find(file => file.path.endsWith(".js")).contents);
const artworkFiles = new Map(bundle.outputFiles
    .filter((file) => file.path.endsWith(".svg"))
    .map((file) => [`/${relative(output, file.path).replaceAll("\\", "/")}`, file.contents]));
const html = `<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>${css.css}\n${bundle.outputFiles.find(file => file.path.endsWith(".css"))?.text ?? ""}</style><body style="font-family:'Noto Sans Thai',sans-serif"><div id="root"></div><script src="/fixture.js"></script></body></html>`;
const server = createServer(async (req, res) => {
    if (req.url === "/fixture.js") { res.setHeader("Content-Type", "text/javascript"); res.end(await readFile(join(output, "fixture.js"))); return; }
    const svg = artworkFiles.get(req.url);
    if (svg) {
        res.setHeader("Content-Type", "image/svg+xml");
        res.end(svg);
        return;
    }
    if (req.url?.startsWith("/api/")) { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify({ status: "linked" })); return; }
    if (req.url?.startsWith("/NHF")) { res.setHeader("Content-Type", "image/png"); res.end(await readFile(join("public", req.url))); return; }
    res.setHeader("Content-Type", "text/html; charset=utf-8"); res.end(html);
});
await new Promise((done) => server.listen(0, "127.0.0.1", done));
const address = server.address();
assert.ok(address && typeof address === "object");
const origin = `http://127.0.0.1:${address.port}`;
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.PLAYWRIGHT_MODULE)).href : "playwright");
const browser = await chromium.launch({ executablePath: process.env.MOBILE_NAV_BROWSER_PATH || undefined, headless: true });
const assetSelector = 'img[src^="/_next/static/media/"][src$=".svg"]';
const moduleIds = ["stock", "leave", "routine", "it-ticket"];
const menuIds = ["employee-management", "add-employee", "email-request", "announcements", "audit-logs", "authorization-administration"];
const sources = (ids, suffix = "") => ids.map((id) => `/_next/static/media/${id}${suffix}.svg`);
const expectedAssets = sources(moduleIds);

async function checkArtwork(scope, expected, size = 64) {
    const images = scope.locator(`${assetSelector}:visible`);
    await images.nth(expected.length - 1).waitFor();
    const measure = () => images.evaluateAll((elements) => elements.map((image) => ({
        source: image.getAttribute("src"),
        alt: image.getAttribute("alt"),
        width: image.offsetWidth,
        height: image.offsetHeight,
    })));
    const before = await measure();
    await images.evaluateAll((elements) => Promise.all(elements.map((image) => image.decode())));
    const assets = await measure();
    assert.deepEqual(assets, before, "Artwork keeps its dimensions through decoding");
    assert.deepEqual(assets.map((asset) => asset.source), expected);
    assert.ok(assets.every((asset) => asset.alt === "" && asset.width === size && asset.height === size));
}

async function captureMore(page, filename) {
    const viewport = page.viewportSize();
    // Dashboard scrolls inside its workspace. Use a taller capture to expose the entire list.
    await page.setViewportSize({ ...viewport, height: 1300 });
    await page.screenshot({ animations: "disabled", path: join(menuScreenshots, filename) });
    await page.setViewportSize(viewport);
}

const waitForLinkedCard = (page) => page.getByText("เชื่อมบัญชี NHFapp กับ LINE แล้ว", { exact: true }).waitFor();

let cases = 0;
try {
    for (const width of (process.argv[2] ? [Number(process.argv[2])] : [320, 375, 390, 422, 768, 1024, 1440])) {
        for (const theme of ["light", "dark"]) {
            const page = await browser.newPage({ viewport: { width, height: 900 } });
            const errors = [];
            page.on("pageerror", (error) => errors.push(error.message));
            page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
            page.on("requestfailed", (request) => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
            page.on("response", (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
            for (const path of ["/dashboard", "/dashboard/more", "/dashboard/stock", "/liff/routine"]) {
                await page.goto(origin + path);
                await page.locator("#root > *").waitFor();
                if (theme === "dark") await page.evaluate(() => document.documentElement.classList.add("dark"));
                const liff = path.startsWith("/liff");
                const mobile = width < 1024;
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width} ${theme} ${path}: overflow`);
                if (!liff) {
                    const bottomNav = page.getByRole("navigation", { name: "เมนูหลักบนมือถือ" });
                    assert.equal(await bottomNav.isVisible(), mobile);
                    assert.equal(await bottomNav.locator(assetSelector).count(), 0);
                    assert.equal(await page.getByRole("complementary", { name: "แถบนำทางหลัก" }).isVisible(), !mobile);
                    if (path === "/dashboard") {
                        const grid = page.getByRole("region", { name: "เมนูด่วน" });
                        await waitForLinkedCard(page);
                        assert.equal(await grid.isVisible(), mobile);
                        if (mobile) {
                            await checkArtwork(grid, expectedAssets);
                            assert.equal(await grid.locator(".dashboard-compact-actions").evaluate(el => getComputedStyle(el).gridTemplateColumns.split(" ").length), width < 360 ? 3 : 4);
                            const boxes = await grid.getByRole("button").evaluateAll(items => items.map(el => { const b = el.getBoundingClientRect(); return { width: b.width, height: b.height }; }));
                            assert.ok(boxes.every(box => box.width >= 44 && box.height >= 112));
                            assert.deepEqual(await grid.locator("[data-shortcut-id]").evaluateAll(items => items.map(el => el.dataset.shortcutId)), ["stock", "leave-management", "routine", "it-workspace"]);
                            const visual = await grid.locator("[data-shortcut-id]").evaluateAll(items => items.map(el => {
                                const icon = el.querySelector("[data-shortcut-icon]");
                                const label = el.querySelector("[data-shortcut-label]");
                                return { transparent: getComputedStyle(el).backgroundColor === "rgba(0, 0, 0, 0)", border: getComputedStyle(el).borderWidth, artworkTransparent: getComputedStyle(icon).backgroundColor === "rgba(0, 0, 0, 0)", labelOutside: label.parentElement === el, labelFits: label.scrollHeight <= label.clientHeight && label.scrollWidth <= label.clientWidth };
                            }));
                            assert.ok(visual.every(item => item.transparent && item.border === "0px" && item.artworkTransparent && item.labelOutside && item.labelFits));
                            assert.equal(await page.evaluate(() => {
                                const announcement = document.querySelector('[aria-label="ประกาศ"]');
                                const heading = document.querySelector("#dashboard-home-heading");
                                const actions = document.querySelector('[aria-label="เมนูด่วน"]');
                                return announcement.getBoundingClientRect().bottom <= heading.getBoundingClientRect().top && heading.getBoundingClientRect().bottom <= actions.getBoundingClientRect().top && !!(announcement.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING);
                            }), true);
                        } else {
                            const featured = page.getByRole("heading", { name: "Recommended" }).locator("..");
                            const regular = page.getByRole("heading", { name: "บริการอื่นๆ" }).locator("..");
                            await checkArtwork(featured, expectedAssets);
                            await checkArtwork(regular, sources(menuIds), width >= 1280 ? 48 : 32);
                            assert.ok(await regular.locator("h3").evaluateAll((labels) => labels.every(
                                (label) => label.scrollWidth <= label.clientWidth && label.scrollHeight <= label.clientHeight + 1,
                            )));
                            assert.equal(await regular.getByRole("button", { name: /นำเข้าจาก CSV/ }).count(), 0);
                            const toggle = page.getByRole("button", { name: "ย่อเมนู", exact: true });
                            await toggle.click();
                            assert.equal(await page.getByRole("button", { name: "ขยายเมนู", exact: true }).isVisible(), true);
                            const sidebar = page.getByRole("complementary", { name: "แถบนำทางหลัก" });
                            assert.equal(await sidebar.locator(assetSelector).count(), 0);
                            assert.equal(await sidebar.getByRole("button", { name: "วัสดุและคลัง" }).locator("svg").count(), 1);
                            if (menuScreenshots && width === 1440 && theme === "light") {
                                await page.waitForFunction(() => document.querySelector('aside[aria-label="แถบนำทางหลัก"]').getBoundingClientRect().width < 100);
                                await regular.getByRole("heading", { level: 2 }).evaluate(el => el.scrollIntoView({ block: "start", behavior: "instant" }));
                                await page.screenshot({ animations: "disabled", path: join(menuScreenshots, "1440-dashboard-menu-collapsed-light.png") });
                            }
                            if (screenshots && width === 1440 && theme === "light") {
                                await page.waitForFunction(() => document.querySelector('aside[aria-label="แถบนำทางหลัก"]').getBoundingClientRect().width < 100);
                                await page.getByRole("heading", { name: "Recommended" }).evaluate((heading) => heading.scrollIntoView({ block: "start", behavior: "instant" }));
                                await page.screenshot({ animations: "disabled", path: join(screenshots, "1440-dashboard-collapsed-light.png") });
                            }
                            await page.getByRole("button", { name: "ขยายเมนู", exact: true }).click();
                            await page.waitForFunction(() => document.querySelector('aside[aria-label="แถบนำทางหลัก"]').getBoundingClientRect().width >= 255);
                            if (menuScreenshots) {
                                await regular.getByRole("heading", { level: 2 }).evaluate(el => el.scrollIntoView({ block: "start", behavior: "instant" }));
                                await page.screenshot({ animations: "disabled", path: join(menuScreenshots, `${width}-dashboard-menu-${theme}.png`) });
                            }
                            const employees = regular.getByRole("button", { name: /^ข้อมูลพนักงาน/ });
                            await page.keyboard.press("Tab");
                            await employees.focus();
                            assert.ok(await employees.evaluate(el => el.matches(":focus-visible") && getComputedStyle(el).boxShadow !== "none"));
                            await employees.press("Enter");
                            await page.waitForURL("**/dashboard/employees");
                            await page.goBack();
                            await page.waitForURL("**/dashboard");
                            await waitForLinkedCard(page);
                        }
                    }
                    if (path === "/dashboard/more" && mobile) {
                        const more = page.getByRole("navigation", { name: "เมนูเพิ่มเติม" });
                        const allMoreIds = [moduleIds[1], moduleIds[0], ...moduleIds.slice(2), ...menuIds, "import-employee"];
                        await checkArtwork(more, sources(allMoreIds, "-compact"), 24);
                        assert.ok(await more.locator("li > a").evaluateAll((rows) => rows.every((row) =>
                            row.getBoundingClientRect().height >= 56 && row.scrollWidth <= row.clientWidth
                            && row.lastElementChild.scrollWidth <= row.lastElementChild.clientWidth,
                        )));
                        const sessions = more.getByRole("link", { name: "อุปกรณ์ที่เข้าสู่ระบบ" });
                        assert.equal(await sessions.locator("svg").count(), 1);
                        assert.equal(await sessions.locator("img").count(), 0);
                        if (menuScreenshots && [320, 390].includes(width)) {
                            await captureMore(page, `${width}-more-${theme}.png`);
                        }
                        const importLink = more.getByRole("link", { name: "นำเข้าจาก CSV" });
                        const before = await importLink.boundingBox();
                        await importLink.locator("img").dispatchEvent("error");
                        await importLink.locator('svg[aria-hidden="true"]').waitFor();
                        assert.deepEqual(await importLink.boundingBox(), before);
                        await page.keyboard.press("Tab");
                        await importLink.focus();
                        assert.ok(await importLink.evaluate(el => el.matches(":focus-visible") && getComputedStyle(el).boxShadow !== "none"));
                        await importLink.press("Enter");
                        await page.waitForURL("**/dashboard/employees/import");
                        await page.goBack();
                        await page.waitForURL("**/dashboard/more");
                    }
                    if (path === "/dashboard/stock" && mobile) {
                        const nav = await page.getByRole("navigation", { name: "เมนูหลักบนมือถือ" }).boundingBox();
                        const action = await page.locator(".dashboard-floating-action").boundingBox();
                        assert.ok(action && nav && action.y + action.height <= nav.y);
                        page.once("dialog", dialog => dialog.dismiss());
                        await page.getByRole("link", { name: "เพิ่มเติม", exact: true }).click();
                        assert.equal(new URL(page.url()).pathname, "/dashboard/stock");
                        page.once("dialog", dialog => dialog.accept());
                        await page.getByRole("link", { name: "เพิ่มเติม", exact: true }).click();
                        await page.waitForURL("**/dashboard/more");
                        await page.keyboard.press("Tab");
                        await page.getByRole("link", { name: "งานประจำ", exact: true }).last().focus();
                        assert.equal(await page.locator(":focus").evaluate(el => getComputedStyle(el).outlineStyle !== "none" || getComputedStyle(el).boxShadow !== "none"), true);
                        await page.goBack();
                        await page.waitForURL("**/dashboard/stock");
                        assert.equal(await page.getByRole("link", { name: "วัสดุ", exact: true }).getAttribute("aria-current"), "page");
                        await page.goForward();
                        await page.waitForURL("**/dashboard/more");
                        assert.equal(await page.getByRole("link", { name: "เพิ่มเติม", exact: true }).getAttribute("aria-current"), "page");
                        await page.goto(origin + "/dashboard/it?itTab=queue");
                        assert.equal(await page.getByRole("link", { name: "เพิ่มเติม", exact: true }).getAttribute("aria-current"), "page");
                        page.once("dialog", dialog => dialog.accept());
                        await page.getByRole("link", { name: "หน้าแรก", exact: true }).click();
                        await page.waitForURL("**/dashboard");
                        await page.goBack();
                        await page.waitForURL("**/dashboard/it?itTab=queue");
                        assert.equal(await page.getByRole("link", { name: "เพิ่มเติม", exact: true }).getAttribute("aria-current"), "page");
                        await page.goForward();
                        await page.waitForURL("**/dashboard");
                        assert.equal(await page.getByRole("link", { name: "หน้าแรก", exact: true }).getAttribute("aria-current"), "page");
                        await waitForLinkedCard(page);
                    }
                } else {
                    assert.equal(await page.getByRole("navigation", { name: "เมนูบริการ NHFapp ผ่าน LINE" }).isVisible(), true);
                    assert.equal(await page.getByRole("link", { name: "งานประจำ", exact: true }).getAttribute("aria-current"), "page");
                }
                if (screenshots && (
                    (path === "/dashboard" && [320, 390, 1024, 1440].includes(width))
                    || (width === 390 && ["/dashboard/more", "/liff/routine"].includes(path))
                )) {
                    if (path === "/dashboard" && !mobile) {
                        await page.getByRole("heading", { name: "Recommended" }).evaluate((heading) => heading.scrollIntoView({ block: "start", behavior: "instant" }));
                    }
                    await page.screenshot({ animations: "disabled", path: join(screenshots, `${width}-${path.replaceAll("/", "-").slice(1)}-${theme}.png`) });
                }
                assert.deepEqual(errors, [], `${width} ${theme} ${path}: runtime errors`);
                cases++;
            }
            if (width === 320 || width === 390) {
                for (const [variant, expected] of [["one", 1], ["limited", 2], ["none", 0], ["admin-only", 0], ["disabled", 1], ["long", 4], ["unavailable", 4], ["no-announcement", 4]]) {
                    await page.goto(origin + "/dashboard?fixture=" + variant);
                    const grid = page.getByRole("region", { name: "เมนูด่วน" });
                    await grid.waitFor().catch(cause => { throw new Error(`${variant}: ${errors.join(" | ")}`, { cause }); });
                    await waitForLinkedCard(page);
                    if (theme === "dark") await page.evaluate(() => document.documentElement.classList.add("dark"));
                    assert.equal(await grid.getByRole("button").count(), expected, variant);
                    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, variant);
                    if (variant === "long") assert.equal(await grid.getByRole("button", { name: "งานประจำ" }).evaluate(el => el.scrollWidth <= el.clientWidth), true);
                    if (variant === "no-announcement") assert.equal(await page.getByRole("region", { name: "ประกาศ", exact: true }).count(), 0);
                    if (variant === "unavailable") assert.equal(await grid.getByText("ยังไม่พร้อม", { exact: true }).isVisible(), true);
                    if (variant === "limited") await checkArtwork(grid, [expectedAssets[0], expectedAssets[2]]);
                    if (variant === "disabled") await checkArtwork(grid, [expectedAssets[1]]);
                    if (variant === "unavailable") await checkArtwork(grid, expectedAssets);
                    if (screenshots && width === 390 && ["disabled", "unavailable", "limited", "no-announcement"].includes(variant)) await page.screenshot({ animations: "disabled", path: join(screenshots, `390-dashboard-${variant}-${theme}.png`) });
                    cases++;
                }
            }
            if (width === 390) {
                for (const variant of ["menu-restricted", "menu-no-import", "menu-import-projected", "menu-states"]) {
                    await page.goto(`${origin}/dashboard/more?fixture=${variant}`);
                    if (theme === "dark") await page.evaluate(() => document.documentElement.classList.add("dark"));
                    const more = page.getByRole("navigation", { name: "เมนูเพิ่มเติม" });
                    await more.waitFor();
                    assert.equal(await more.getByRole("link", { name: "นำเข้าจาก CSV" }).count(),
                        ["menu-import-projected", "menu-states"].includes(variant) ? 1 : 0);
                    assert.equal(await more.getByRole("link", { name: "จัดการสิทธิ์การใช้งาน" }).count(),
                        variant === "menu-restricted" ? 0 : 1);
                    const compactModules = [moduleIds[1], moduleIds[0], ...moduleIds.slice(2)];
                    const visibleMenuIds = variant === "menu-restricted" ? [] : menuIds;
                    const importIds = ["menu-import-projected", "menu-states"].includes(variant) ? ["import-employee"] : [];
                    await checkArtwork(more, sources([...compactModules, ...visibleMenuIds, ...importIds], "-compact"), 24);
                    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
                    if (variant === "menu-states") {
                        assert.equal(await more.getByRole("link", { name: /^การลา\s*ยังไม่พร้อมให้บริการ$/ }).count(), 1);
                        assert.equal(await more.getByRole("link", { name: "เพิ่มพนักงาน" }).count(), 0);
                        assert.equal(await more.getByText("เร็วๆ นี้", { exact: true }).isVisible(), true);
                    }
                    if (menuScreenshots && variant !== "menu-import-projected") {
                        await captureMore(page, `390-more-${variant.slice(5)}-${theme}.png`);
                    }
                    cases++;
                }
                for (const disabled of [false, true]) {
                    await page.goto(origin + (disabled ? "/liff?fixture=disabled" : "/liff"));
                    if (theme === "dark") await page.evaluate(() => document.documentElement.classList.add("dark"));
                    const grid = page.locator("[data-shortcut-grid]");
                    await checkArtwork(grid, expectedAssets);
                    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
                    const nav = page.getByRole("navigation", { name: "เมนูบริการ NHFapp ผ่าน LINE" });
                    assert.equal(await nav.isVisible(), true);
                    assert.equal(await nav.locator(assetSelector).count(), 0);
                    const stock = grid.getByRole("link", { name: "เบิกวัสดุ" });
                    await page.keyboard.press("Tab");
                    await stock.focus();
                    assert.equal(await stock.evaluate((element) => element.matches(":focus-visible") && getComputedStyle(element).boxShadow !== "none"), true);
                    await stock.blur();
                    if (disabled) {
                        assert.equal(await grid.locator('[aria-disabled="true"]').count(), 2);
                        assert.equal(await grid.getByRole("link").count(), 2);
                        assert.equal(await grid.getByText("ยังไม่พร้อม", { exact: true }).isVisible(), true);
                        assert.equal(await grid.getByText("เร็ว ๆ นี้", { exact: true }).isVisible(), true);
                    }
                    if (screenshots) await page.screenshot({ animations: "disabled", path: join(screenshots, `390-liff-home${disabled ? "-disabled" : ""}-${theme}.png`) });
                    if (menuScreenshots && !disabled) await page.screenshot({ animations: "disabled", path: join(menuScreenshots, `390-liff-home-${theme}.png`) });
                    if (!disabled) {
                        const artworkSlot = stock.locator("[data-shortcut-icon]");
                        const before = await artworkSlot.boundingBox();
                        await artworkSlot.locator("img").dispatchEvent("error");
                        await artworkSlot.locator('svg[aria-hidden="true"]').waitFor();
                        assert.deepEqual(await artworkSlot.boundingBox(), before);
                        assert.equal(await stock.getByRole("img").count(), 0);
                    }
                    cases++;
                }
            }
            if (width === 1440) {
                for (const variant of ["menu-restricted", "menu-states"]) {
                    await page.goto(`${origin}/dashboard?fixture=${variant}`);
                    if (theme === "dark") await page.evaluate(() => document.documentElement.classList.add("dark"));
                    await page.getByRole("heading", { name: "Recommended" }).waitFor();
                    await waitForLinkedCard(page);
                    if (variant === "menu-restricted") {
                        assert.equal(await page.getByRole("heading", { name: "บริการอื่นๆ" }).count(), 0);
                        await checkArtwork(page, expectedAssets);
                    } else {
                        const comingSoon = page.getByRole("button", { name: /เร็วๆ นี้ เพิ่มพนักงาน/ });
                        assert.equal(await comingSoon.isDisabled(), true);
                        await checkArtwork(comingSoon, sources(["add-employee"]), 48);
                        const leave = page.getByRole("button", { name: /ยังไม่พร้อมให้บริการ.*NHF Leave/ });
                        assert.equal(await leave.isEnabled(), true);
                        if (menuScreenshots) {
                            await comingSoon.scrollIntoViewIfNeeded();
                            await page.screenshot({ animations: "disabled", path: join(menuScreenshots, `1440-dashboard-menu-states-${theme}.png`) });
                        }
                    }
                    cases++;
                }
            }
            assert.deepEqual(errors, [], `${width} ${theme}: unexpected browser or network errors`);
            await page.close();
        }
    }
} finally {
    await browser.close();
    await new Promise((done) => server.close(done));
}
process.stdout.write(`Mobile navigation rendered checks passed: ${cases} cases (Chromium fixture, not real-device E2E).\n`);
