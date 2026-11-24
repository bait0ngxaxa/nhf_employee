# NHFapp Visual Identity System v1.4

Chromium renders the actual Dashboard workspaces and LIFF module components with project CSS, the existing application shells, and the approved SVGs. The fixture supplies synthetic Thai data, capability projections and read-only API responses. The route, history, image and identity adapters exist only in the local browser harness.

## Dashboard at 1440px

| Workspace | Light | Dark |
| --- | --- | --- |
| NHF Leave | [Capture](1440-dashboard-leave-light.png) | [Capture](1440-dashboard-leave-dark.png) |
| NHF Stock | [Capture](1440-dashboard-stock-light.png) | [Capture](1440-dashboard-stock-dark.png) |
| NHF Routine | [Capture](1440-dashboard-routine-light.png) | [Capture](1440-dashboard-routine-dark.png) |
| IT workspace | [Capture](1440-dashboard-it-ticket-light.png) | [Capture](1440-dashboard-it-ticket-dark.png) |
| Employee management | [Capture](1440-dashboard-employee-management-light.png) | [Capture](1440-dashboard-employee-management-dark.png) |
| Add employee | [Capture](1440-dashboard-add-employee-light.png) | [Capture](1440-dashboard-add-employee-dark.png) |
| Import employees | [Capture](1440-dashboard-import-employee-light.png) | [Capture](1440-dashboard-import-employee-dark.png) |
| New employee request | [Capture](1440-dashboard-email-request-light.png) | [Capture](1440-dashboard-email-request-dark.png) |
| Announcement management | [Capture](1440-dashboard-announcements-light.png) | [Capture](1440-dashboard-announcements-dark.png) |
| Authorization administration | [Capture](1440-dashboard-authorization-administration-light.png) | [Capture](1440-dashboard-authorization-administration-dark.png) |
| Audit logs | [Capture](1440-dashboard-audit-logs-light.png) | [Capture](1440-dashboard-audit-logs-dark.png) |

The IT [Queue](1440-dashboard-it-queue-light.png) and [Analytics](1440-dashboard-it-analytics-dark.png) tabs show a single workspace identity. At smaller widths compare [Routine at 1024px](1024-dashboard-routine-dark.png), [Routine at 768px](768-dashboard-routine-light.png), [Import at 390px](390-dashboard-import-employee-light.png), and [Authorization at 320px](320-dashboard-authorization-administration-dark.png). The other responsive Dashboard captures follow the same filename pattern.

## LINE LIFF

| Workspace | 390px light | 390px dark | 320px light | 320px dark |
| --- | --- | --- | --- | --- |
| Stock | [Capture](390-liff-stock-light.png) | [Capture](390-liff-stock-dark.png) | [Capture](320-liff-stock-light.png) | [Capture](320-liff-stock-dark.png) |
| Leave | [Capture](390-liff-leave-light.png) | [Capture](390-liff-leave-dark.png) | [Capture](320-liff-leave-light.png) | [Capture](320-liff-leave-dark.png) |
| Routine | [Capture](390-liff-routine-light.png) | [Capture](390-liff-routine-dark.png) | [Capture](320-liff-routine-light.png) | [Capture](320-liff-routine-dark.png) |
| IT | [Capture](390-liff-it-ticket-light.png) | [Capture](390-liff-it-ticket-dark.png) | [Capture](320-liff-it-ticket-light.png) | [Capture](320-liff-it-ticket-dark.png) |

## State and interaction evidence

- Dashboard [read-only employee directory](390-dashboard-employees-read-only-light.png), [Routine with no export permission and artwork fallback](390-dashboard-routine-fallback-dark.png), and Leave [loading](390-dashboard-leave-loading-light.png) and [feature-disabled](390-dashboard-leave-unavailable-dark.png) states.
- LIFF [Stock request sheet](390-liff-stock-request-light.png), [Leave approvals](390-liff-leave-approvals-dark.png), and Routine [unavailable](390-liff-routine-unavailable-light.png), [loading](390-liff-routine-loading-dark.png), and [artwork fallback](390-liff-routine-fallback-light.png) states.
- LIFF [IT request form](390-liff-it-create-light.png) and [ticket detail](390-liff-it-detail-dark.png) retain contextual headings. The sticky master logo and navigation remain visible.

The workspace checks exercise primary artwork resolution and decoding, empty alt text, heading count and focusability, responsive artwork geometry, horizontal overflow, the Routine export, CSV back and authorization refresh controls, IT tab changes, and artwork fallback without moving the heading. API requests stay local to the fixture.

## Reproduce

```powershell
$env:PLAYWRIGHT_MODULE = 'C:/path/to/playwright/index.mjs'
$env:MOBILE_NAV_BROWSER_PATH = 'C:/path/to/chrome.exe'
$env:WORKSPACE_HEADER_SCREENSHOT_DIR = 'docs/verification/workspace-header-visual-identity'
node scripts/check-mobile-navigation.mjs --workspace-headers
node scripts/check-mobile-navigation.mjs

npm run architecture:check
npm run lint:strict
npx --no-install next typegen
npm run typecheck
npm run test
npm run build
node scripts/check-module-asset-delivery.mjs
```

For a targeted workspace capture, append a supported width such as `--workspace-headers 390`. The separate IT Analytics browser regression uses `node scripts/check-it-analytics-dashboard.mjs`, with `PUPPETEER_MODULE` and `CHART_BROWSER_PATH` set to the local Puppeteer and Chromium paths.

## Verification limits

The workspace captures are component-fixture evidence. The authenticated App Router and live LINE session flows require an authorized browser session or test account, which was unavailable. The signed-out smoke check uses the built Next.js app and exercises SVG delivery and the Dashboard login redirect. Chrome emulates viewport dimensions and theme. Physical safe-area insets, real devices, screen-reader operation and production font delivery need separate checks. Thai text uses Chromium's local fallback when Noto Sans Thai is unavailable.
