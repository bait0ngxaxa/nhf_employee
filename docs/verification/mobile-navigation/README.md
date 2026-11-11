# Mobile-first Dashboard navigation verification

Base: `545ddd13d5e05041efc6d76104160f74cbf4d1af` (`main`).
Read-only DEMI behavioral reference: `46f27bcf161f124d2c3231612db6778ea3d52919`.

## Architecture and scope

- `DashboardProvider` continues to derive `availableMenuGroups` with the existing
  `getAvailableMenuGroups()` and server-owned capability projections. The mobile
  projection only ranks these items: Home, up to three eligible destinations,
  More. Priority is Routine, Stock, Leave, IT, then existing group/item order.
  Disabled/coming-soon features do not occupy primary slots. Unavailable Leave
  remains discoverable through its existing unavailable page in More/Home.
- Routes come from `lib/ssot/routes.ts`. Home matches exactly; module paths match
  complete segments. Module query parameters remain module-owned; query changes
  do not select Home. Overflow routes do not select an unrelated primary tab.
- `/dashboard/more` inherits the existing authenticated server layout and lists
  every supplied authorized group. Account, theme, sessions and logout reuse the
  extracted existing account menu. No settings destination was invented.
- Only the visual item-class function is shared with LIFF. LIFF keeps its own
  routes, static navigation adapter, bootstrap, session, availability and execution
  channel. Its sticky scroll model differs from the fixed browser shell, so
  sharing either shell or permission projection would add unnecessary coupling.
- Browser mobile height is scoped to `.dashboard-app-shell` below `lg` (1024px).
  Scroll padding and Stock/Leave floating-action offsets reserve bottom-nav space.
  Existing modal forms retain their focus/dismiss protection. Inline approver
  assignments, IT conversation drafts, employee/new-staff-request forms and
  announcement edits expose their existing state to the new navigation links;
  cancelling keeps the form mounted. This is not a new
  global browser-unload/history interception system.
- `FeaturedCard` and `RegularCard` implementations, desktop Sidebar primitives,
  server route-access code remain unchanged. Desktop grid classes remain unchanged.
  Mobile launcher shortcuts use only `featuredItems` in `FEATURED_ORDER` (Stock,
  Leave, Routine, IT), the existing icons, handlers and module tokens on icon tiles.
  Administrative/secondary services remain in More and Desktop Sidebar only.
  Published announcements precede greeting/actions in DOM and visual order; null
  announcements render no empty container. Unavailable Leave stays navigable with
  a subdued tile and visible status.
- No schema, migration, package, API, business-rule, authentication or session
  changes. No summaries, KPI widgets or summary fetching were introduced.

## Executed local evidence

- `npx prisma generate`: passed (Prisma 6.19.3).
- `npm run architecture:check`: passed, 1493 repository source files.
- Focused Vitest regression command: **20 files, 192 tests passed**, covering
  Dashboard mobile projection, Home, More/authenticated layout, navbar, sidebar,
  layout focus/scroll, provider, route SSOT, LIFF navigation, direct Routine,
  Stock, Leave, IT and authorization-administration boundaries, IT activity and
  Leave approver state.
- `npm run typecheck`: passed.
- Additional focused regression after the final inline-form/account hardening:
  **4 files, 23 tests passed**, covering the More logout confirmation, announcement
  conflicts/retained drafts and Email Request section/provider behavior.
- Initial `npm run lint:strict` found one `console.log` warning in the new browser
  script. Replaced it with `process.stdout.write`; targeted ESLint then passed.
  Final `npm run lint:strict` passed; targeted ESLint on the subsequently changed
  inline-form markers and account regression also passed.
- `git diff --check`: passed; complete source diff reviewed against `main`,
  including Thai strings and unchanged authorization/business boundaries.
- Existing Vite config emits a native-config-loader warning. It was not suppressed
  and does not fail the executed tests. Prisma reports its existing package.json
  configuration deprecation; configuration/dependencies were not changed.

## Rendered browser evidence

`node scripts/check-mobile-navigation.mjs` passed **88 cases** in local Chromium:
320, 375, 390, 422, 768, 1024, 1440px; light and dark themes; Dashboard Home, More,
an inline-form/floating-action fixture and LIFF shell. Additional 320/390px
fixtures cover one/two/no modules, administrative-only services, disabled flags,
long Thai source labels, unavailable Leave and unpublished announcements.
Assertions verify the exact four allowed IDs, transparent outer wrappers, one
64px icon tile, labels outside tiles and announcement DOM/visual order.
Home focused Vitest: **20 tests passed** after the product correction.
Checks cover navigation visibility at `lg`, 3/4-column density, 44px minimum
targets, no horizontal page overflow, sidebar collapse/expand, keyboard focus,
cancel/accept navigation with dirty state, browser history and floating-action
clearance. Browser/server are closed after the check. Generated scratch bundles
are outside the repository.

The script follows the repository's existing standalone browser-test pattern.
It bundles real components and project CSS while replacing Next routing,
identity and API boundaries with explicit fixtures. Screenshots below are actual
renders of those components, **not authenticated application E2E/UAT evidence**.
The API fixture returns a linked LINE account; LINE production connectivity was
not exercised. Pending status has separate component-test coverage.

Run using an existing Playwright installation and Chromium executable, without
adding project packages:

```powershell
$env:PLAYWRIGHT_MODULE = 'C:/path/to/playwright/index.mjs'
$env:MOBILE_NAV_BROWSER_PATH = 'C:/path/to/chrome.exe'
$env:MOBILE_NAV_SCREENSHOT_DIR = 'C:/path/to/screenshots'
node scripts/check-mobile-navigation.mjs
```

Optional positional argument selects one viewport for focused feedback, e.g.
`node scripts/check-mobile-navigation.mjs 390`.

| Surface | Light | Dark |
| --- | --- | --- |
| Dashboard 390px | [render](390-dashboard-light.png) | [render](390-dashboard-dark.png) |
| No announcement 390px | [render](390-dashboard-no-announcement-light.png) | [render](390-dashboard-no-announcement-dark.png) |
| Unavailable Leave 390px | [render](390-dashboard-unavailable-light.png) | [render](390-dashboard-unavailable-dark.png) |
| Stock/Routine only 390px | [render](390-dashboard-limited-light.png) | [render](390-dashboard-limited-dark.png) |
| More 390px | [render](390-dashboard-more-light.png) | [render](390-dashboard-more-dark.png) |
| Desktop 1440px | [render](1440-dashboard-light.png) | [render](1440-dashboard-dark.png) |
| LIFF 390px | [render](390-liff-routine-light.png) | [render](390-liff-routine-dark.png) |

## Remaining verification boundaries

Actual iOS Safari, nonzero hardware safe-area insets, virtual-keyboard behavior,
physical touch, live session expiry/permission refresh, production LINE linking
and authenticated App Router E2E were not executed. Safe-area CSS and viewport-fit
are preserved, but Chromium viewport screenshots cannot establish iOS behavior.
Existing direct-route tests remain the evidence for server authorization; menu
visibility is not an authorization boundary. Hosted CI is the full regression
gate and is reported against the final PR HEAD. No full local unit/integration
suite or production build was run.

## Rollback

Revert the task commits through an owner-reviewed PR. No database migration or
business-data repair is required. Reverting restores the previous browser drawer,
Home presentation and LIFF item styling without changing either channel's auth.
