# NHFapp v1.5 LINE Rich Menu visual verification

These files are offline renders of the unified Rich Menu. `before.png` is the committed asset at baseline `a20adf16` (PR #31). It shows the previous repository artwork. The previous image deployed to any live channel was outside this review.

## Reproduce

Run from the repository root with Node 24, installed dependencies and Sharp's native SVG and Pango text support. Sharp loads `assets/fonts/NotoSansThai-Variable.ttf` directly and checks Thai text rendering. Keep the bundled font readable on disk. Pango, libvips, or other native rendering versions can affect output across platforms. The reviewed output was regenerated on Windows with Node 24.22.1.

```powershell
npm run line:richmenu:asset
$env:NEXT_PUBLIC_LINE_LIFF_ID = 'rich-menu-fixture'
npx --no-install tsx scripts/preview-nhf-rich-menu.ts
```

The preview command uses a synthetic LIFF ID to evaluate the existing definition locally. The generator needs no LINE configuration. Preserve `before.png` as the v1.5 review baseline when reproducing the previews.

## Generated artwork

- [Full source PNG](after-2500.png) — 2500 × 843px, 106,175 bytes, decoded successfully and fully opaque. This copy matches `assets/line/nhf-rich-menu.png`.
- [430px](preview-430.png) · [390px](preview-390.png) · [360px](preview-360.png) · [320px](preview-320.png). All four files scale the same PNG proportionally, with the height rounded to whole pixels.
- [Before](before.png) · [Contact sheet](contact-sheet.png) · [Action-area diagnostic](tap-area-overlay.png).
- Repeated generation on this workstation produced the same SHA-256 `cba24c4810fba10139112c5dc0dd1a3963e47c06fff1499c23b13694fbc688cc`. Byte-for-byte repeatability across native rendering environments was outside the test.

## Visual review and tap alignment

The old image used saturated backgrounds, large diagonals, line icons and three tiers of copy. The new image pairs each approved module icon with one dark, bold Thai label on a lightly tinted surface. The artwork uses a 360px square before downscaling. The generator centers each label using the measured raster width and height and enforces margins before composition. The English identifiers and supporting descriptions were omitted to keep the Thai service labels prominent.

The full PNG, all four mobile previews, contact sheet and action overlay were inspected manually. All four silhouettes were recognizable. The narrowest preview retained enough room for the longest label, `งานของฉัน`, and visible Thai marks above and below the text. The art and labels are separated vertically and remain inside the correct action areas. The overlay draws from the real Rich Menu definition, with strokes kept inside the areas so the outer edges stay visible.

| Destination | Primary artwork in `public/assets/modules/` | Display label | URI action label | LIFF suffix | Bounds (x, y, w, h) |
| --- | --- | --- | --- | --- | --- |
| Stock | `stock.svg` | เบิกวัสดุ | เบิกวัสดุ | `/stock` | 0, 0, 625, 843 |
| Leave | `leave.svg` | ลางาน | ลางาน | `/leave` | 625, 0, 625, 843 |
| Routine | `routine.svg` | งานของฉัน | งานของฉัน | `/routine` | 1250, 0, 625, 843 |
| IT | `it-ticket.svg` | แจ้งปัญหา | แจ้ง IT | `/it` | 1875, 0, 625, 843 |

## Regression coverage

`npm run test -- __tests__/line/nhf-rich-menu-generation.test.ts __tests__/line/nhf-rich-menu.test.ts __tests__/line/rich-menu-provisioning.test.ts` passed 47 tests across three files. The tests cover the decoded image, bounds and tile ordering, missing inputs, replacement safety, the legacy wrapper, the unchanged action contract and mocked provisioning and rollback behavior. Generation and previewing used no live LINE requests. Actual LINE chat rendering, mobile taps, rollout and rollback on a live channel remain operator checks. [Operator runbook](../../operations/production-deployment.md#5-unified-rich-menu-source-of-truth)
