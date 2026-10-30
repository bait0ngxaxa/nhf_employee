import { build } from "esbuild";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";
import puppeteer from "puppeteer";
const out = await mkdtemp(join(tmpdir(), "line-focus-"));
await build({
  stdin: {
    contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {DashboardHomeSection} from './components/dashboard/sections/DashboardHomeSection'; window.fetch=async()=>({ok:true,json:async()=>({status:'linked'})}); createRoot(document.getElementById('root')).render(<DashboardHomeSection/>);`,
    resolveDir: process.cwd(),
    loader: "tsx",
  },
  bundle: true,
  jsx: "automatic",
  outfile: join(out, "app.js"),
  loader: { ".png": "dataurl" },
  plugins: [
    {
      name: "stubs",
      setup(b) {
        b.onResolve(
          { filter: /^next\/(image|dynamic)$|^@\/lib\/line\/liff-links$|^@\/components\/dashboard\/context\/dashboard\/DashboardContext$/ },
          (a) => ({ path: a.path, namespace: "stub" }),
        );
        b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => ({
          contents:
            a.path === "next/image"
              ? 'import React from "react"; export default function Image(p){return React.createElement("img",p)}'
              : a.path === "next/dynamic"
                ? 'import React from "react"; export default () => () => React.createElement("span", null, "สวัสดี")'
                : a.path.includes("DashboardContext")
                  ? 'export const useDashboardDataContext=()=>({user:{name:"สมชาย วัฒนศิริกุลมหาประเสริฐอัครวัฒนสมบูรณ์ (ชาย)",department:"IT",teams:[]},availableMenuGroups:[]}); export const useDashboardUIContext=()=>({handleMenuClick(){}})'
                  : 'export const buildLiffUrl=()=>"https://liff.line.me/test"',
          resolveDir: process.cwd(),
        }));
      },
    },
  ],
});
const css = await postcss([tailwind()]).process(
  await readFile("app/globals.css", "utf8"),
  { from: resolve("app/globals.css") },
);
await writeFile(
  join(out, "index.html"),
  `<html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css.css}</style><div id="root"></div><script src="app.js"></script></html>`,
);
const browser = await puppeteer.launch({ headless: true });
try {
  for (const width of [320, 390, 768, 1280])
    for (const touch of [false, true]) for (const theme of ["light", "dark"]) {
      const page = await browser.newPage();
      await page.setViewport({
        width,
        height: 500,
        hasTouch: touch,
        isMobile: touch,
      });
      await page.goto(pathToFileURL(join(out, "index.html")).href);
      if (theme === "dark") await page.evaluate(() => document.documentElement.classList.add("dark"));
      await page.waitForFunction(() =>
        document.querySelector('a[href="https://liff.line.me/test"]'),
      );
      const visible = await page.$eval(
        'a[href="https://liff.line.me/test"]',
        (e) => getComputedStyle(e).display !== "none",
      );
      if (visible !== (width < 768 || touch))
        throw Error(`link visibility ${width} ${touch} ${visible}`);
      const layout = await page.evaluate(() => {
        const section = document.querySelector('section[aria-labelledby="line-add-friend-heading"]');
        const heading = document.querySelector('#dashboard-home-heading');
        const info = section.querySelector('h2').parentElement;
        const action = section.querySelector('button');
        const greeting = heading.firstElementChild;
        const name = greeting.nextElementSibling;
        return {overflow: document.documentElement.scrollWidth > innerWidth, infoWidth: info.getBoundingClientRect().width,
          infoBottom: info.getBoundingClientRect().bottom, actionTop: action.getBoundingClientRect().top,
          headingWidth: heading.clientWidth, headingScroll: heading.scrollWidth, greetingDisplay: getComputedStyle(greeting).display,
          name: name.textContent, nickname: heading.textContent.includes('(ชาย)')};
      });
      if (layout.overflow || layout.infoWidth < 120 || layout.headingScroll > layout.headingWidth || !layout.nickname || !layout.name.includes('วัฒนศิริกุล')) throw Error(JSON.stringify(layout));
      if (width < 640 && (layout.actionTop < layout.infoBottom || layout.greetingDisplay !== 'block')) throw Error(JSON.stringify(layout));
      if (width >= 640 && layout.greetingDisplay !== 'inline') throw Error(JSON.stringify(layout));
      await page.click("button[data-slot=dialog-trigger]");
      await page.waitForSelector("[role=dialog]");
      const result = await page.evaluate(() => ({
        focus: document.activeElement?.getAttribute("data-slot"),
        scroll: document.querySelector("[data-slot=dialog-scroll-area]")
          .scrollTop,
      }));
      if (await page.$('[role=dialog] a[href="https://liff.line.me/test"]')) throw Error('duplicate LIFF link');
      if (result.focus !== "dialog-title" || result.scroll !== 0)
        throw Error(JSON.stringify(result));
      process.stdout.write(`${width} ${touch ? "touch" : "fine"} ${theme} ${JSON.stringify(result)}\n`);
      await page.close();
    }
} finally {
  await browser.close();
}
