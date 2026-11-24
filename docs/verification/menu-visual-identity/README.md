# NHFapp Visual Identity System v1.2

The [contact sheet](contact-sheet.png) compares the four existing Level 1 identities and seven new Level 2 identities on light and dark surfaces. Primary artwork is shown at 96, 48, and 32 CSS pixels and compact artwork at 24 and 20 CSS pixels.

## Chromium component fixture evidence

| Surface and scenario | Light | Dark |
| --- | --- | --- |
| Dashboard regular service cards · 1440px | [Render](1440-dashboard-menu-light.png) | [Render](1440-dashboard-menu-dark.png) |
| Dashboard regular service cards · 1024px | [Render](1024-dashboard-menu-light.png) | [Render](1024-dashboard-menu-dark.png) |
| Dashboard · 1440px, collapsed Sidebar | [Render](1440-dashboard-menu-collapsed-light.png) | |
| Dashboard · 1440px, coming-soon Add Employee | [Render](1440-dashboard-menu-states-light.png) | [Render](1440-dashboard-menu-states-dark.png) |
| More · 390px, administrator with Employee Import | [Render](390-more-light.png) | [Render](390-more-dark.png) |
| More · 320px, administrator with Employee Import | [Render](320-more-light.png) | [Render](320-more-dark.png) |
| More · 390px, administrator without Employee Import | [Render](390-more-no-import-light.png) | [Render](390-more-no-import-dark.png) |
| More · 390px, restricted user | [Render](390-more-restricted-light.png) | [Render](390-more-restricted-dark.png) |
| More · 390px, unavailable Leave and coming-soon Add Employee | [Render](390-more-states-light.png) | [Render](390-more-states-dark.png) |
| LINE LIFF Home · 390px, module artwork regression | [Render](390-liff-home-light.png) | [Render](390-liff-home-dark.png) |

The 104-case Chromium run mounts the actual Dashboard and LIFF components with project CSS, the local SVG files, synthetic capability and availability inputs, and adapters for Next.js routing, images and the LIFF API. It exercises the application's administrative menu projection and the More-only Employee Import path with the capability present and absent. A duplicate-input fixture verifies that More presents one import entry. The state fixtures use unavailable Leave and a synthetic coming-soon Add Employee entry.

Horizontal overflow, Thai label fit, 56px More touch targets, keyboard focus and activation, decorative alt text, image decoding, box stability after decoding and fallback, and browser or request errors are checked at a 900px viewport height. More captures use the same widths and a 1300px height so the full list and account utilities are visible inside the scrolling Dashboard workspace. Peripheral checks cover the mobile home shortcuts, the four featured cards, collapsed Sidebar, Dashboard Bottom Navigation, and LIFF Home and Bottom Navigation. The fixture uses local browser font fallback if Noto Sans Thai is unavailable.

```powershell
$env:PLAYWRIGHT_MODULE = 'C:/path/to/playwright/index.mjs'
$env:MOBILE_NAV_BROWSER_PATH = 'C:/path/to/chrome.exe'
$env:MENU_IDENTITY_SCREENSHOT_DIR = 'docs/verification/menu-visual-identity'
node scripts/check-mobile-navigation.mjs
```

## Automated verification

```powershell
npx --no-install prisma generate
npm run architecture:check
npm run lint:strict
npm run typecheck
npm run test
npm run build
node scripts/check-module-asset-delivery.mjs
```

Registry coverage checks all 11 primary and compact pairs, their source files, 128 × 128 viewBox, file size and existing Lucide fallbacks. Presentation tests cover destination mapping, capability visibility, accessible names, navigation, unavailable and coming-soon states, and fallback. The production smoke runs after build locally and in the Production Build CI job. It checks all 22 generated static SVGs return HTTP 200 with an SVG content type without a session, and checks that the signed-out Dashboard returns HTTP 307 to login.

## Verification limits

Authenticated App Router E2E was unavailable because the repository has no configured authorized browser test account or authenticated browser session fixture. These captures establish component rendering and behavior. Live LINE sign-in and linking, physical-device safe areas, screen-reader operation, and production font rendering remain unverified.
