# NHFapp Visual Identity System v1.3

Chromium renders the existing Dashboard and LINE LIFF components with project CSS and the approved compact SVGs. Every capture uses a 900px viewport height. Dashboard sidebar fixtures use the existing capability-filtered groups plus synthetic availability states. Mobile fixtures select existing routes through a browser-history adapter.

| Surface and scenario | Light | Dark |
| --- | --- | --- |
| 1440px expanded Sidebar · Home active | [Render](1440-sidebar-expanded-light.png) | [Render](1440-sidebar-expanded-dark.png) |
| 1440px collapsed Sidebar · Home active | [Render](1440-sidebar-collapsed-light.png) | [Render](1440-sidebar-collapsed-dark.png) |
| 1024px expanded Sidebar · Home active | [Render](1024-sidebar-light.png) | [Render](1024-sidebar-dark.png) |
| 1440px expanded Sidebar · Employee Management active, internal services group closed | [Render](1440-sidebar-admin-active-light.png) | [Render](1440-sidebar-admin-active-dark.png) |
| 1440px Sidebar · restricted menus | [Render](1440-sidebar-restricted-light.png) | [Render](1440-sidebar-restricted-dark.png) |
| 1440px Sidebar · unavailable Leave and coming-soon Add Employee | [Render](1440-sidebar-states-light.png) | [Render](1440-sidebar-states-dark.png) |
| 1440px collapsed Sidebar · Stock fallback, keyboard focus and tooltip | [Render](1440-sidebar-fallback-light.png) | [Render](1440-sidebar-fallback-dark.png) |
| 390px Dashboard Bottom Navigation · Home active | [Render](390-dashboard-nav-light.png) | [Render](390-dashboard-nav-dark.png) |
| 320px Dashboard Bottom Navigation · Home active | [Render](320-dashboard-nav-light.png) | [Render](320-dashboard-nav-dark.png) |
| 390px Dashboard Bottom Navigation · More active | [Render](390-dashboard-nav-more-light.png) | [Render](390-dashboard-nav-more-dark.png) |
| 390px Dashboard Bottom Navigation · Stock active | [Render](390-dashboard-nav-stock-light.png) | [Render](390-dashboard-nav-stock-dark.png) |
| 390px Dashboard Bottom Navigation · Stock fallback | [Render](390-dashboard-nav-fallback-light.png) | [Render](390-dashboard-nav-fallback-dark.png) |
| 390px Dashboard Bottom Navigation · Stock and Routine projection | [Render](390-dashboard-nav-limited-light.png) | [Render](390-dashboard-nav-limited-dark.png) |
| 390px Dashboard Bottom Navigation · secondary administrative destinations | [Render](390-dashboard-nav-admin-only-light.png) | [Render](390-dashboard-nav-admin-only-dark.png) |
| 390px LIFF Bottom Navigation · Routine active | [Render](390-liff-nav-light.png) | [Render](390-liff-nav-dark.png) |
| 320px LIFF Bottom Navigation · Routine active | [Render](320-liff-nav-light.png) | [Render](320-liff-nav-dark.png) |
| 390px LIFF Bottom Navigation · nested IT ticket, top indicator | [Render](390-liff-nav-nested-light.png) | [Render](390-liff-nav-nested-dark.png) |
| 390px LIFF Home · Home active | [Render](390-liff-nav-home-light.png) | [Render](390-liff-nav-home-dark.png) |

## Reproduce the browser check

```powershell
$env:PLAYWRIGHT_MODULE = 'C:/path/to/playwright/index.mjs'
$env:MOBILE_NAV_BROWSER_PATH = 'C:/path/to/chrome.exe'
$env:NAVIGATION_IDENTITY_SCREENSHOT_DIR = 'docs/verification/navigation-visual-identity'
node scripts/check-mobile-navigation.mjs
```

The harness checks compact source paths, 24px artwork slots, decorative alt text, functional Home and More icons, active semantics, and image decoding. It dispatches image error events and checks that fallback keeps both the control and artwork slot in place. Sidebar checks cover the 80px collapsed rail, tooltips on hover and keyboard focus, keyboard activation, group collapse, long Thai labels, and unavailable and coming-soon behavior. Bottom navigation checks cover touch targets, capability projections, history, unsaved-change guards, nested paths and LIFF's active indicator. Cross-surface checks cover Dashboard cards, mobile shortcuts, More and LIFF Home.

## Verification limits

The fixture supplies in-memory capability inputs and adapters for Next.js routing, images and the LIFF API. Authenticated App Router E2E was not run because an authorized browser account or session fixture was unavailable. The signed-out production smoke verifies the actual server redirect and all 22 build SVGs. Physical safe-area insets, live LINE authentication, the LINE in-app browser, screen-reader operation and production font rendering were outside this fixture. Chromium uses its local font fallback if Noto Sans Thai is unavailable.

At narrow widths a long secondary Dashboard tab label can still end in an ellipsis under the existing single-line layout. The full Thai link name stays available to assistive technology. Compact artwork requires no geometry changes.
