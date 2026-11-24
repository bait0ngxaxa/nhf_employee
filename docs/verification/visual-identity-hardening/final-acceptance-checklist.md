# Visual Identity operator acceptance

Record the release SHA, browser/device, account capability profile and result for each check. Use authorized test accounts and assets. Keep personal data and channel identifiers in operator-controlled records.

## Application release

- [ ] Sign in on a desktop and verify the Dashboard cards, workspace headers, expanded Sidebar and collapsed Sidebar. Check keyboard focus, tooltip names and navigation with a screen reader.
- [ ] Sign in on mobile and verify Home, More and active navigation. Use restricted capability profiles to exercise administrative short labels, unavailable modules, deep links and unsaved-change guards.
- [ ] Observe workspace loading on a throttled connection. Block an approved SVG temporarily in browser tools, then verify the fallback, unchanged controls and focus. Check the browser console during authenticated App Router transitions.
- [ ] Open LIFF from LINE on Android and iPhone. Check master branding, Bottom Navigation, safe areas, module links, nested content and the authorized account-linking flow. Repeat with the device screen reader.
- [ ] Record application UAT separately from any decision to roll out a LINE Rich Menu.

## LINE Rich Menu rollout

- [ ] Verify the intended channel and record its current default through the existing read-only status command.
- [ ] Run offline artifact verification and review the dry-run plan and rollback target. Obtain explicit operator approval before any apply command.
- [ ] After an approved rollout, reopen the LINE chat and verify the displayed default, including any per-user overrides. Tap Stock, Leave, Routine and IT and check the expected landing screen, access checks and unavailable states.
- [ ] Keep the prior default available and confirm the rollback procedure with the operator. [Production operator runbook](../../operations/production-deployment.md#5-unified-rich-menu-source-of-truth)
