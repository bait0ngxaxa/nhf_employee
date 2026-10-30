# Organizational announcement ticker

`modules/announcements` owns one organizational plain-text announcement for
authenticated Dashboard employees. There is no Team/Department filter, LIFF
entry, public read, scheduling, delivery channel or acknowledgement workflow.

## Boundary and authorization

- Server entry: `@/modules/announcements`; client entry:
  `@/modules/announcements/client`. Validation and DTOs live in the module's
  browser-safe domain contract. Prisma access lives only in its infrastructure.
- `GET /api/announcements` requires `requireApiSession` and projects only
  published content. Management `GET` and `POST /api/announcements/manage`
  require `requireAdminSession`. Existing active web-session/workforce checks
  reject missing, revoked or ineligible sessions. API responses use no-store.
- POST uses the existing trusted-origin/AJAX mutation wrapper, bounded UTF-8
  JSON reader (8 KiB), and process-local IP/principal mutation rate limiter.
  Trusted requests return 401 without a session and 403 for non-ADMIN users;
  requests failing CSRF checks return 403 before session resolution.
- The service repeats the ADMIN check; persistence locks and re-reads the
  actor's current active/non-deleted account and role inside the transaction.
  The generic Authorization Resolver and business grants are unchanged.

## Lifecycle and consistency

The migration seeds a single unpublished `Announcement` row with id 1 and
version 0. A database CHECK fixes the id to 1, the primary key prevents a
second slot, and another CHECK forbids empty published content. No create or
delete operation is exposed. Author/updater foreign keys use SET NULL so
account deletion cannot remove the announcement or its text. Audit retains
the actor email as well as the user reference.

`save` stores an unpublished draft, `publish` saves and publishes, and
`unpublish` retains the text while hiding it and rejects already unpublished
content without writing or auditing. Saving a draft also hides any
previously published text; the form explains this explicitly. This is one
editable slot, without a separate draft revision or publication history CMS.

Every mutation carries the version observed by the admin. The atomic Prisma
`updateMany({ where: { id: 1, version }, data: { version: { increment: 1 } } })`
must affect exactly one row; otherwise the API returns 409. The client retains
unsaved text, offers an explicitly confirmed reload, and never blindly retries
a mutation. A repeated successful command with its old version returns 409
without applying changes or producing a second audit record.

The initial author and first-write timestamp are preserved after the first
save. Each update records the updater and update timestamp. A strict
`ANNOUNCEMENT_UPDATE` audit append stores before/after content, publication
state, versions and the action in the same transaction. Audit failure rolls
back the announcement mutation.

Content is trimmed, non-empty, limited to 500 UTF-16 code units (the same
count used by HTML textarea maxlength), and rejects non-text control
characters. Thai/English Unicode and newlines are preserved. HTML-like text
is stored literally and rendered only as React text, including the preview.

## Freshness and accessibility

The authenticated Dashboard server component queries the database without a
shared cache, then passes a server-rendered ticker slot above the greeting.
Mutation handlers call `revalidatePath` for Dashboard and management. Loads
and refreshes read current state; an already open Dashboard does not update
until navigation/refresh. No polling or realtime transport is added.

The ticker has one accessible text copy and one aria-hidden visual copy. CSS
animates matching halves right-to-left. Hover and keyboard focus within the
text viewport pause movement, independently of the Pause/Resume button. The
keyboard-operable pause button removes animation and wraps the entire text,
including long unbroken strings, within mobile widths. Reduced motion uses
that readable static layout and hides the motion control. No live region or
marquee element is used. The existing NHF tokens and primitives are retained.

## Migration

Deploy `prisma/migrations/20261030090000_announcement_ticker/migration.sql`
before starting the new application version. Use MySQL 8.0.16+ with enforced
CHECK constraints, as described in the
[MySQL documentation](https://dev.mysql.com/doc/refman/8.0/en/alter-table.html).
The audit enum value is appended to preserve existing value ordering.

```sh
npx prisma migrate deploy
npx prisma generate
```

Use the existing release database credentials and normal migration process.
Do not use `db push`; it does not represent the custom singleton checks or
seeded row. Do not delete the singleton row. No migration has been applied to
the application's configured database as part of this implementation.

## Focused verification commands

```sh
npm run test -- __tests__/api/announcements.test.ts modules/announcements/presentation/announcements.test.tsx
node scripts/check-announcement-ticker.mjs
npm run architecture:check
npm run lint:strict
npm run typecheck
```

The browser smoke script uses the installed esbuild/PostCSS/Puppeteer
toolchain and the real React components and CSS. It verifies 320/390/768/1280px,
short/long content, reduced motion, focus/hover pause, keyboard read-full-text
and overflow. It captures manager/conflict and Dashboard placement using
isolated session-context/transport fixtures, not a live authenticated API.
It reuses cached next/font Noto Sans Thai or fetches that same font family
when no prior Next output exists. No development server is required.
jsdom mocks only the CSS module because the existing Next PostCSS plugin
array is not accepted by Vite; actual CSS is checked by Chromium.

Real MySQL tests are in
`__tests__/integration/announcements.integration.test.ts`. They require the
existing dedicated test database and migrated schema. The repository's
`npm run test:integration:mysql` prepares migrations and runs all integration
tests. For a focused run, supply the dedicated test DATABASE_URL and run:

```sh
npx prisma migrate deploy
npx vitest run --config vitest.integration.config.ts __tests__/integration/announcements.integration.test.ts
```

The test guards against non-test database names and restores the singleton
snapshot after removing its own fixtures. This environment currently refuses
connections at the configured test server `127.0.0.1:3309`, and Docker is not
installed. The real-DB suite cannot initialize; its four cases remain
unverified. Mocked lifecycle tests do not establish database rollback or
constraint enforcement.
