# NHFapp Visual Identity System v1

The [asset contact sheet](contact-sheet.png) compares primary artwork at 96 and 64px and compact artwork at 32 and 24px on neutral light, raised dark, and module-colored surfaces. All eight SVG files use the same 128 × 128 viewBox and each is under the 15 KB budget.

## Chromium renders

| Surface and fixture | Light | Dark |
| --- | --- | --- |
| Dashboard · 1440px | [Render](1440-dashboard-light.png) | [Render](1440-dashboard-dark.png) |
| Dashboard · 1440px, collapsed sidebar | [Render](1440-dashboard-collapsed-light.png) | |
| Dashboard · 1024px | [Render](1024-dashboard-light.png) | [Render](1024-dashboard-dark.png) |
| Dashboard · 390px | [Render](390-dashboard-light.png) | [Render](390-dashboard-dark.png) |
| Dashboard · 320px | [Render](320-dashboard-light.png) | [Render](320-dashboard-dark.png) |
| Dashboard · 390px, Stock and Routine capability projection | [Render](390-dashboard-limited-light.png) | [Render](390-dashboard-limited-dark.png) |
| Dashboard · 390px, unavailable Leave remains discoverable | [Render](390-dashboard-unavailable-light.png) | [Render](390-dashboard-unavailable-dark.png) |
| Dashboard · 390px, disabled feature flags | [Render](390-dashboard-disabled-light.png) | [Render](390-dashboard-disabled-dark.png) |
| LINE LIFF Home · 390px | [Render](390-liff-home-light.png) | [Render](390-liff-home-dark.png) |
| LINE LIFF Home · 390px, unavailable Leave and coming-soon IT | [Render](390-liff-home-disabled-light.png) | [Render](390-liff-home-disabled-dark.png) |

The existing mobile navigation harness renders the real Dashboard and LIFF components with project CSS, locally served production SVG files, synthetic workforce data, and test adapters for Next.js routing and the LIFF Home response. Desktop captures scroll to show all four featured cards. The 92-case run checks image decoding, matching asset paths, decorative alt text, 64px geometry, overflow, Dashboard touch targets and label fit, keyboard focus, existing navigation, and browser and network errors. An injected image error checks that the decorative Lucide fallback preserves the artwork slot.

Run the fixture using an existing Playwright installation and Chromium executable.

```powershell
$env:PLAYWRIGHT_MODULE = 'C:/path/to/playwright/index.mjs'
$env:MOBILE_NAV_BROWSER_PATH = 'C:/path/to/chrome.exe'
$env:MOBILE_NAV_SCREENSHOT_DIR = 'C:/path/to/screenshots'
node scripts/check-mobile-navigation.mjs
```

## Focused local checks

- `npx --no-install prisma generate`, `npm run architecture:check`, `npm run lint:strict`, and `npm run typecheck` passed.
- The command below passed all 162 tests across 10 files.

```powershell
npm run test -- __tests__/components/BrandAsset.test.tsx __tests__/components/DashboardHomeSection.test.tsx __tests__/components/LiffHome.test.tsx __tests__/components/DashboardSidebar.test.tsx __tests__/components/DashboardMobileNavigation.test.tsx __tests__/components/LiffNavigation.test.tsx __tests__/constants/dashboard-menu.test.ts __tests__/lib/dashboard-mobile-navigation.test.ts __tests__/lib/liff-home.test.ts __tests__/dashboard-route-access.test.ts
```

## Production asset delivery

The source SVGs stay in `public/assets/modules/`. The registry uses static imports so Next.js serves the artwork through its existing `/_next/static/media/` paths. Both Dashboard and LINE LIFF can load this artwork. The smoke check launches the production build on loopback, requests all eight generated SVGs without a session, and verifies the existing Dashboard login redirect.

```powershell
npm run build
node scripts/check-module-asset-delivery.mjs
```

## Verification boundaries

The captures establish rendered component behavior under the fixture data. Authenticated App Router hydration, physical-device safe-area behavior, screen-reader operation, and LINE sign-in and account linking remain unverified. The fixture leaves production authentication intact and uses synthetic server-boundary inputs. Server authorization evidence comes from separate focused route and capability tests.
