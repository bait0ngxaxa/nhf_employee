# NHFapp Visual Identity System v1.6 verification

Approved baseline `7f94f6c4` on `main` includes PRs #28–32. The implementation under test includes `35f6d299` for fallback, `40535fdd` for navigation labels, `2968c752` and `36a1b897` for header stability, and `3d0741f` for Rich Menu integrity. The approved design is locked and v1.1 desktop redesign was cancelled.

## Visual comparison

Screenshots are Chromium component-fixture renders with synthetic data. Identical browser, viewport, theme and fixture inputs were used for the baseline and the implementation. The comparison counts changed RGB pixels and records their bounds.

- All 12 sampled ready-state captures matched pixel for pixel. Examples include [Dashboard cards](baseline-comparison/1440-dashboard-menu-light.png), [expanded Sidebar](baseline-comparison/1440-sidebar-expanded-light.png), [collapsed Sidebar](baseline-comparison/1440-sidebar-collapsed-dark.png), [More](baseline-comparison/390-more-dark.png), [LIFF Home](baseline-comparison/390-liff-nav-home-light.png), [Routine](baseline-comparison/390-dashboard-routine-light.png), and [IT Analytics](baseline-comparison/1440-dashboard-it-analytics-dark.png). [Full pixel comparison](baseline-comparison/pixel-comparison.json)
- The 390px administrative projection changed only in the label strip. The 320, 360, 390 and 430px checks assert label fit and touch targets across core, secondary, mixed, restricted, unavailable, single and empty projections. [Before](mobile-navigation-labels/390-dashboard-nav-admin-only-before-light.png) · [390px after](mobile-navigation-labels/390-dashboard-nav-admin-only-light.png) · [320px](mobile-navigation-labels/320-dashboard-nav-admin-only-light.png) · [360px](mobile-navigation-labels/360-dashboard-nav-system-only-dark.png) · [430px](mobile-navigation-labels/430-dashboard-nav-mixed-dark.png)
- Compact fallback measures about 19.2px in a 24px slot. The 32px LIFF primary slot renders a 20px fallback. The browser checks the artwork and control boxes before and after failure. [Collapsed Sidebar](fallback-states/1440-sidebar-fallback-light.png) · [Bottom Navigation](fallback-states/390-dashboard-nav-fallback-dark.png) · [LIFF header](fallback-states/390-liff-routine-fallback-light.png)

## Workspace geometry

The fixture swaps the actual route skeleton for the actual workspace at a fixed viewport without user input and measures the header, artwork slot, title, text group, first action where present, and following content block with `getBoundingClientRect()`. The 80 pairs cover eight routes at 1440, 1024, 768, 390 and 320px in both themes. For routes such as top-level IT and Authorization that keep a workspace header while their own content loads, the harness checks loaded content and header behavior without fabricating a route skeleton.

| Measurement | Before | After |
| --- | ---: | ---: |
| Stock following content Y delta below desktop | −32px | 0px |
| Leave following content Y delta at 320 / 390px | +36px | +20px |
| Employee Management following content Y delta at 320 / 390px, light | −41px | +3px |
| Employee Management artwork Y delta at 1024px, light | −17px | +1px |
| Routine following content Y delta at 320px, with export | +100px | +84px |

Values are ready minus loading. Stock reserved a badge absent from the loaded header. Employee Management reserved three buttons and could wrap at 1024px. Loading styles now reserve the established header gap and the two known employee actions. The remaining Leave delta reflects a wrapped subtitle. At 320px, Routine's two extra subtitle lines and permission-dependent 44px export action account for 84px. Import and Email Request can also grow to fit wrapped Thai text. The checks assert exact artwork slot dimensions, horizontal text alignment within 1px, Stock content alignment within 1px, and small allowances for Employee Management borders and text. These measurements are component geometry, without a production CLS score. The harness also exercises feature-disabled Leave, read-only employee access, restricted Routine, asset decoding and fallback, and actual loaded content for the IT ticket list and Analytics. [Before data](workspace-layout-measurements/before.json) · [After data](workspace-layout-measurements/after.json)

## Local commands and results

| Command | Result |
| --- | --- |
| `npm run architecture:check` | Passed, 1,521 sources |
| `npm run lint:strict` | Passed |
| `npx --no-install next typegen` and `npm run typecheck` | Passed |
| `npm run build` and `node scripts/check-module-asset-delivery.mjs` | Passed, 22 signed-out SVG responses and Dashboard login redirect |
| `node scripts/check-mobile-navigation.mjs` | 174 cases passed |
| `node scripts/check-mobile-navigation.mjs --workspace-headers` | 186 cases passed |
| `npm run test:it-analytics-dashboard:browser` | 56 cases passed |
| `npm run test:it-analytics:browser` | Standalone chart fixture timed out waiting for `.recharts-bar` in 24 cases. Reproduced at 320px on the approved baseline with `npm run test:it-analytics:browser -- 320`. Inspecting the baseline browser bundle showed `process is not defined` before the chart mounted. The Dashboard Analytics fixture passed. |
| `npm run test -- __tests__/components/BrandAsset.test.tsx` | 4 tests passed |
| `npm run test -- __tests__/components/DashboardMobileNavigation.test.tsx __tests__/lib/dashboard-mobile-navigation.test.ts` | 52 tests passed |
| `npm run test -- __tests__/line/nhf-rich-menu-generation.test.ts __tests__/line/nhf-rich-menu.test.ts __tests__/line/rich-menu-provisioning.test.ts` | 57 tests passed, including mocked provision and rollback |
| `npm run line:richmenu:asset` and `npm run line:richmenu:verify` | Passed. Repeated generation left both files byte-identical. [Rich Menu integrity](rich-menu-integrity/README.md) |
| `npm run test:integration:mysql` | Local disposable runner could not start or clean up because Docker Compose was unavailable (`ENOENT`). Hosted CI supplies Docker and checks both normal and failure-path cleanup. |

For browser reproduction set `PLAYWRIGHT_MODULE` to the installed Playwright entry point and `MOBILE_NAV_BROWSER_PATH` to Chromium. Set `NAVIGATION_IDENTITY_SCREENSHOT_DIR`, `MENU_IDENTITY_SCREENSHOT_DIR`, or `WORKSPACE_HEADER_SCREENSHOT_DIR` to a new evidence directory. `WORKSPACE_HEADER_MEASUREMENTS_PATH` writes the geometry JSON. Analytics Dashboard uses `PUPPETEER_MODULE` and `CHART_BROWSER_PATH`.

GitHub Actions runs offline artifact verification in Code Quality and the signed-out SVG smoke in Production Build. Review the four jobs and test totals for the exact PR HEAD. [Branch CI results](https://github.com/bait0ngxaxa/nhf_employee/actions/workflows/ci.yml?query=branch%3Afeat%2Fnhf-visual-identity-hardening)

## Remaining verification

The built-runtime check covers anonymous SVG delivery and the login redirect. Authenticated App Router navigation and hydration require an authorized account or environment. Chromium emulates viewport sizes and themes. Physical devices, real safe areas, the LINE in-app browser, actual default Rich Menu state, live account linking and screen-reader behavior remain operator checks. [Operator acceptance checklist](final-acceptance-checklist.md)
