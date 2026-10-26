# IT analytics chart browser smoke test

Run `npm run test:it-analytics:browser` after installing the locked development dependencies. The script uses the existing esbuild, PostCSS/Tailwind and Puppeteer toolchain to render the actual chart component with project styles and deterministic fixture data. It does not start Next.js, fetch analytics, or access a database.

Puppeteer uses its installed browser by default. To use an existing Chromium browser, set `CHART_BROWSER_PATH` to its executable. For example, in PowerShell:

```powershell
$env:CHART_BROWSER_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
npm run test:it-analytics:browser
```

The 24 cases cover 320px, 390px, 768px and 1280px; `7D`, `30D` and `90D`; and light/dark themes. Assertions check page overflow, measurable chart height, desktop weekly fit, mobile scrolling, keyboard selection, synthesized touch dragging and tapping, viewport-contained selected values, and no overlap between the fixed readout and the plot. Screenshots are written to the printed temporary artifact directory; the result summary is printed to stdout and failures exit nonzero.

For a focused check while changing the chart, append a supported width, for example `npm run test:it-analytics:browser -- 320`. The touch check waits for native momentum scrolling to settle before tapping; a tap during momentum scrolling is consumed by the browser to stop it.

The selected-period readout is deliberately outside the scrolling plot, labelled in Thai, and reserves space so it cannot cover bars. Recharts still supplies the selected bucket and both values through its Tooltip integration. Touch/pen input selects the supported `click` trigger; mouse movement restores `hover`. Tests tap two different buckets and verify the readout changes, then confirm mouse hover still works after touch. Weekly charts reserve 3rem per bucket, while the X axis independently reduces label density; no data buckets are removed.

This is an isolated component smoke test in Chromium with synthesized touch input. It does not verify the authenticated dashboard shell, physical devices, iOS Safari/WebKit, screen-reader speech, or device-specific performance. Physical iPhone/Android acceptance remains a separate manual check: swipe the chart in both directions, tap near both edges, inspect dates/counts and the daily disclosure, then repeat in both themes.
