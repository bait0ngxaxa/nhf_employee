---
name: "Employee Management System (NHF)"
description: "ศูนย์กลางงานภายใน NHF สำหรับข้อมูลพนักงาน คำขอ และงานปฏิบัติการ"
colors:
  primary: "oklch(0.588 0.158 241.966)"
  background: "oklch(0.985 0.004 247)"
  surface-raised: "#ffffff"
  surface-subtle: "#f8fafc"
  content-heading: "#020617"
  content-body: "#334155"
  content-muted: "#64748b"
  border-subtle: "#e2e8f0"
  brand-solid: "#0ea5e9"
  brand-foreground: "#0284c7"
  brand-strong: "#0c4a6e"
  brand-deep: "#082f49"
  content-on-brand: "#ffffff"
  action-primary-solid: "#2563eb"
  action-gradient-end: "#0891b2"
  status-danger-solid: "#e11d48"
  status-success-solid: "#059669"
  status-warning-solid: "#d97706"
  status-info-solid: "#0e7490"
  module-leave: "#4f46e5"
  module-stock: "#ea580c"
  module-routine: "#0d9488"
typography:
  display:
    fontFamily: "Noto Sans Thai, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Noto Sans Thai, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Noto Sans Thai, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.5
  body:
    fontFamily: "Noto Sans Thai, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.75
  label:
    fontFamily: "Noto Sans Thai, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0.08em"
rounded:
  sm: "0.4rem"
  md: "0.525rem"
  lg: "0.65rem"
  xl: "0.9rem"
  2xl: "1rem"
  3xl: "1.5rem"
  pill: "9999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
  2xl: "2.5rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.content-on-brand}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.75rem"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.content-body}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.75rem"
  button-destructive:
    backgroundColor: "{colors.status-danger-solid}"
    textColor: "{colors.content-on-brand}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1rem"
    height: "2.75rem"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.content-body}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0.5rem 0.75rem"
    height: "2.75rem"
  card:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.content-body}"
    rounded: "{rounded.xl}"
    padding: "1.5rem"
  badge-status:
    backgroundColor: "{colors.brand-solid}"
    textColor: "{colors.content-on-brand}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0.125rem 0.75rem"
  badge-success:
    backgroundColor: "{colors.status-success-solid}"
    textColor: "{colors.content-on-brand}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0.125rem 0.75rem"
  section-tabs:
    backgroundColor: "transparent"
    textColor: "{colors.content-body}"
    rounded: "0"
    padding: "0.75rem 1rem"
    height: "2.75rem"
  navigation-sidebar-item:
    backgroundColor: "transparent"
    textColor: "{colors.content-body}"
    rounded: "{rounded.xl}"
    padding: "0.5rem 0.75rem"
    height: "2.75rem"
  featured-module-card:
    backgroundColor: "{colors.module-leave}"
    textColor: "{colors.content-on-brand}"
    rounded: "{rounded.2xl}"
    padding: "1.25rem"
    height: "12.25rem"
  liff-bottom-nav:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.content-muted}"
    rounded: "0"
    padding: "0.375rem 0.5rem"
    height: "3rem"
---

# Design System: Employee Management System (NHF)

## Overview

**Creative North Star: "The Trusted Operations Desk"**

NHFapp is an Operate-first internal work surface. Its visual language should feel calm, structured, and dependable: a cool pale canvas, raised work surfaces, restrained borders, and high-contrast Thai typography make dense administrative tasks easier to scan. Sky blue and blue-cyan carry NHF's identity and the next clear action, while indigo, orange, and teal distinguish the major service modules without turning the interface into a marketing page.

The same language spans the desktop dashboard and the LINE/LIFF mobile experience. Desktop uses a persistent sidebar and sticky utility bar; mobile uses safe-area-aware sticky header and bottom navigation. The dashboard home intentionally gives the three core modules richer, lifted cards, while ordinary management sections remain quieter and information-first. Dark mode keeps the same semantic relationships with charcoal surfaces and brighter text, borders, and accents.

**Key Characteristics:**

- Thai-first, direct, polite, and work-oriented
- Cool neutral canvas with blue-led identity
- Clear status and ownership signals for operational workflows
- Quiet data surfaces with a deliberate rich-card exception for core modules
- Responsive density that preserves touch targets and scanability

## Colors

The palette is a cool blue system with neutral work surfaces and small, semantic bursts of color. Saturation communicates identity, action, module, or state; it is not used as decoration without meaning.

### Primary

- **Core Cool Blue** (`colors.primary`): Default control, link, and focus color used by the shared button, badge, tooltip, and Radix-style primitives.
- **Brand Sky** (`colors.brand-solid`): NHF identity, active navigation icons, selected mobile navigation, and the strongest brand emphasis.
- **Deep Brand Blue** (`colors.brand-strong`, `colors.brand-deep`): Readable brand text and headings on pale brand surfaces.

### Secondary

- **Action Blue** (`colors.action-primary-solid`): The solid treatment for prominent actions and action-colored controls.
- **Action Cyan** (`colors.action-gradient-end`): The cool endpoint of the blue-to-cyan action gradient, reserved for high-salience entry points.

### Tertiary

- **Leave Indigo** (`colors.module-leave`): Leave-related tabs, badges, and featured dashboard surfaces.
- **Stock Orange** (`colors.module-stock`): Material and stock-related tabs, badges, and featured dashboard surfaces.
- **Routine Teal** (`colors.module-routine`): Routine-work tabs, badges, and featured dashboard surfaces.

### Neutral

- **Cool Paper** (`colors.background`): The default application canvas.
- **Raised White** (`colors.surface-raised`): Cards, dialogs, menus, and other foreground work surfaces.
- **Quiet Slate** (`colors.surface-subtle`): Section shells, dashboard framing, and low-emphasis containers.
- **Ink** (`colors.content-heading`): Page headings and the highest-priority text.
- **Work Slate** (`colors.content-body`): Body copy, field values, and ordinary interactive text.
- **Muted Slate** (`colors.content-muted`): Supporting copy, metadata, labels, and disabled-adjacent content.
- **Soft Divider** (`colors.border-subtle`): One-pixel separators and quiet component boundaries.

### Semantic States

Use the status families for meaning that crosses modules: danger for destructive or failed outcomes, success for completed or confirmed outcomes, warning for attention, and info for neutral guidance. Each family has matching surface, border, icon, foreground, and solid tokens in `app/globals.css`; pair the color with a text label or icon so meaning never depends on color alone.

The dark theme maps the canvas to `#09090b`, raised surfaces to `#18181b`, and the sidebar to `#141416`. Dark mode uses the brighter members of each semantic family for text and focus while retaining the same brand/module assignments.

**The Signal-First Rule.** Blue identifies NHF and the next action; indigo, orange, and teal identify modules; semantic state colors communicate outcomes. Do not use those colors as arbitrary decoration.

**The Quiet Canvas Rule.** Keep most of a screen neutral. Reserve saturated fills, gradients, and lifted shadows for an action, a module entry point, or a state that needs attention.

## Typography

**Display Font:** Noto Sans Thai (with `ui-sans-serif`, `system-ui`, and `sans-serif` fallbacks)

**Body Font:** Noto Sans Thai (with `ui-sans-serif`, `system-ui`, and `sans-serif` fallbacks)

**Label/Mono Font:** No separate label or mono family; labels stay in Noto Sans Thai.

**Character:** One Thai-first family keeps the product coherent across employee data, workflow status, reports, and LINE surfaces. Medium body weight and bold headings create a firm, readable hierarchy without a separate editorial display face.

### Hierarchy

- **Display** (700, `2.25rem` and up to `3rem` at larger widths, `1.12` line-height): Dashboard welcome and public entry-point hero headings.
- **Headline** (700, `1.5rem`, `1.25` line-height): Section titles, prominent card headings, and high-level workspace headings.
- **Title** (700, `1.125rem`, `1.5` line-height): Card titles, nav identity, and supporting page titles.
- **Body** (500, `1rem`, `1.75` line-height; `0.875rem` is used for dense supporting copy): Forms, explanations, table values, and workflow instructions. Keep long prose near `50–65ch` where the layout allows.
- **Label** (600–700, `0.75rem`, `1.25` line-height, modest tracking): Metadata, role labels, status labels, and compact navigation. Uppercase tracking is used selectively for short Latin labels such as roles or quick-action markers.

**The Thai-First Hierarchy Rule.** Preserve natural Thai line wrapping and readable leading. Do not compress Thai labels to fit an English-shaped layout; let controls grow or wrap while retaining the minimum touch target.

## Layout

The product is an Operate-mode application: a desktop shell frames scrollable workspaces, while compact mobile surfaces prioritize one-handed navigation and safe-area padding.

- **Desktop shell:** A persistent sidebar begins at the `lg` breakpoint (`1024px`), uses `16rem` width at default desktop and `18rem` at `2xl`, and can collapse to `5rem`. The sticky utility bar and independently scrolling main area keep navigation available during long tasks.
- **Content frames:** The dashboard home uses a `max-w-7xl` frame (`80rem`), large management sections commonly use `max-w-6xl` (`72rem`), and focused forms use narrower `max-w-3xl` frames (`48rem`). Center content and avoid full-bleed data unless the table genuinely needs the width.
- **Rhythm:** The recurring spacing cadence is `0.5rem`, `1rem`, `1.5rem`, and `2rem`, with larger `2.5rem` section padding at wide desktop. Section shells step from `1rem` padding on small screens to `1.5rem` and `2.5rem` on larger layouts.
- **Responsive density:** Grids move from one column to two, three, and four columns as space permits. Featured module cards are one column on narrow screens and become multi-column/row layouts at container breakpoints. Tabs scroll horizontally on small screens and distribute across the available width on desktop.
- **LINE/LIFF:** The mobile shell is capped at `max-w-lg` (`32rem`) and uses a sticky header plus a four-column bottom nav. Use `env(safe-area-inset-*)` for edge padding and keep important actions at least `2.75rem` high.

**The Progressive Density Rule.** Add columns and breathing room as the viewport grows; do not shrink text or touch targets to force desktop density onto mobile.

## Elevation & Depth

Depth is primarily tonal: cool paper, quiet slate, and raised white surfaces establish the hierarchy before shadows appear. Ordinary cards and shells use restrained `shadow-sm` or no shadow; featured dashboard cards use `shadow-lg` at rest and `shadow-xl` on hover. The logo, sidebar toggle, and sticky table edge have dedicated ambient shadows. State changes are communicated with border, background, and focus-ring shifts before lift.

### Shadow Vocabulary

- **Brand control ambient** (`--sidebar-toggle-shadow` / `--brand-logo-shadow`): Soft two-layer shadow for the logo and compact sidebar control.
- **Table edge separation** (`--employee-table-sticky-shadow`): Directional shadow at a sticky table edge so horizontal scrolling remains legible.
- **Quiet container** (`shadow-none` or `shadow-sm`): Default for forms, section shells, dialogs, and ordinary data cards where content hierarchy matters more than lift.
- **Featured module lift** (`shadow-lg` → `shadow-xl`): Reserved for dashboard quick-action cards and their hover response.

The established motion grammar is short and state-led: most controls transition over `150–200ms`; dashboard cards enter over `420ms` with `cubic-bezier(0.22, 1, 0.36, 1)`; the stock-card sheen runs for `850ms` on hover. The global reduced-motion rule reduces transitions to `120ms`, removes decorative animation, and avoids smooth scrolling.

**The Tonal Layer Rule.** Establish depth with surface roles and borders first; use a shadow only when it clarifies a floating, sticky, or interactive relationship.

**The State-Only Lift Rule.** A component may lift on hover or active response when that movement explains interactivity. Static content should not look like a collection of floating cards.

## Shapes

The base geometry is gently rounded and consistent. `--radius` is `0.65rem`; shared controls use the derived `rounded-md` shape, cards and shells use `rounded-xl`, dashboard feature cards step up to `rounded-2xl` or `rounded-3xl`, and status/role labels use a pill silhouette. Dialogs and mobile menu surfaces use the same family rather than introducing a new corner language.

Borders are normally one pixel and cool-neutral or semantic. Use a stronger border for focus, selection, or a meaningful module accent; do not outline every nested element. The tab rail is an intentional exception: it stays visually flat with a two-pixel active bottom rule. Controls and links preserve a minimum `2.75rem` touch height, including on mobile where compact visual density is useful.

**The Explicit Geometry Rule.** Use the shared radius scale for recurring components; reserve one-off radii such as the app logo mask or decorative dashboard corner for those signature elements only.

**The One Touch Target Rule.** Keep interactive controls at least `2.75rem` high and give keyboard focus a visible `2–3px` ring with an offset where the surrounding surface is busy.

## Components

### Buttons

Buttons should feel direct, calm, and dependable: one clear action, medium-weight Thai text, and a stable touch target.

- **Shape:** Gently rounded shared control (`rounded-md`, derived from the `0.65rem` base radius).
- **Primary:** `bg-primary` with `text-primary-foreground`, `0.5rem 1rem` padding, and `2.75rem` default height. Use the blue-to-cyan gradient only for a high-salience entry point that already has a clear action hierarchy.
- **Hover / Focus:** Use a modest color shift rather than a large scale change. Shared primitives use a `3px` focus ring; custom buttons use a `2px` ring with an offset. Featured cards may translate by `0.5px` to `2px` when the movement communicates pressability.
- **Secondary / Ghost / Tertiary:** Outline buttons keep the work-surface background and a quiet border; secondary buttons use the muted neutral fill; ghost buttons reveal background only on hover. Destructive buttons use the danger family and must retain a text label.
- **Disabled:** Keep the layout stable, suppress pointer interaction, and use reduced opacity; do not communicate disabled state by color alone.

### Chips

- **Style:** The shared `Badge` is compact, border-aware, and normally uses `rounded-md`, `0.5rem` horizontal padding, and `0.75rem` text. Role and status badges may use a pill shape when their compact identity benefits from it.
- **State:** Use semantic surface/foreground/border combinations for selected, pending, success, warning, or destructive states. A selected tab is not a badge; keep its state in the tab underline pattern.

### Cards / Containers

- **Corner Style:** Generic cards use `rounded-xl`; dashboard frames use `rounded-2xl` to `rounded-3xl`; compact data panels may use `rounded-lg` or `rounded-xl`.
- **Background:** Use `surface-raised` for a work surface, `surface-subtle` for a quiet frame, and semantic/module surfaces only when the color explains a state or destination.
- **Shadow Strategy:** Follow Elevation & Depth. Ordinary cards stay flat or softly lifted; featured module cards are the sanctioned rich-card exception.
- **Border:** Start with `border-subtle` or `border-soft`; strengthen only for focus, selection, module identity, or an edge that needs separation.
- **Internal Padding:** Shared card internals commonly use `1.5rem`; compact panels use `1rem` to `1.25rem`; featured cards use `1.25rem` and expand at larger container widths.

### Inputs / Fields

- **Style:** Full-width fields use `2.75rem` height, `rounded-md`, a one-pixel input border, transparent or background-colored fill, and `0.75rem` horizontal padding. Text is body-sized and placeholders use muted content.
- **Focus:** Shift the border to the ring color and add a visible `3px` soft ring. Keep the field's surrounding geometry stable.
- **Error / Disabled:** Pair the danger border/ring with an explanatory message; disabled fields suppress interaction and reduce opacity without hiding the value.

### Navigation

- **Desktop sidebar:** `16rem` wide by default, `18rem` at `2xl`, or `5rem` collapsed. It uses `sidebar` background and border tokens. Items are at least `2.75rem` high with `rounded-xl`; active items use sidebar accent plus a brand-colored icon tile.
- **Utility bar:** Sticky at the top of the workspace with a faint bottom border and a translucent surface. Keep notifications, account controls, and the mobile menu trigger in the same predictable row.
- **Mobile/LIFF:** The LIFF header is sticky and safe-area aware. The bottom nav is a four-column, `2.75rem`-minimum control with a small brand-colored active rule and label; inactive items stay muted but remain fully legible.

### Section Tabs

Tabs are a workspace navigation pattern, not decorative pills. The rail scrolls horizontally on small screens, has a quiet bottom border, and gives the active tab a configurable `2px` module-colored underline. Group separators and labels are used only when they make a long tab set easier to scan.

### Status & Empty States

State panels use a raised surface, a rounded border, an icon or shape tile, plain-language Thai explanation, and an explicit next action where one exists. Loading skeletons echo the same radius and surface hierarchy. Empty, error, and access-denied states should be recognizable by text and structure even when semantic colors are unavailable.

### Module Quick-Action Card

The dashboard's featured cards are the signature component. Each card combines a module-specific solid surface, a translucent sheen/corner, a compact icon tile, a `Quick action` marker, a two-line heading, supporting copy, and an arrow control. Stock, leave, and routine use their own semantic tokens; the composition stays shared so the modules feel related rather than like separate products.

## Do's and Don'ts

### Do:

- **Do** use Noto Sans Thai for all product UI and preserve natural Thai wrapping.
- **Do** keep page backgrounds, data surfaces, and ordinary containers in the cool neutral family.
- **Do** map blue to NHF/next action, module colors to their module, and semantic colors to outcomes.
- **Do** preserve `2.75rem` touch targets, visible keyboard focus, and safe-area padding on mobile.
- **Do** use borders and tonal layers before adding a shadow.
- **Do** keep desktop and LINE/LIFF surfaces visually related through the same semantic tokens.

### Don't:

- **Don't** turn an internal workflow screen into a marketing landing page or add unsupported claims.
- **Don't** use saturated module or status colors as generic decoration.
- **Don't** rely on color alone for status, errors, selection, or permission outcomes.
- **Don't** introduce a second font family, arbitrary radius scale, or unrelated component style.
- **Don't** compress Thai copy, hide important actions behind unpredictable patterns, or reduce mobile touch targets.
- **Don't** make every card look elevated; reserve rich fills and strong lift for purposeful module entry points.
