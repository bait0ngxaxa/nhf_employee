# GitHub Actions CI

## Purpose and scope

[NHF Employee CI](../../.github/workflows/ci.yml) is the full technical regression gate. It follows [DEMI PR #1](https://github.com/bait0ngxaxa/demi/pull/1) while retaining NHF's MySQL, architecture checker and existing Vitest suites. [AGENTS.md Sections 9–10](../../AGENTS.md#9-testing-and-verification) are the authoritative agent delivery contract; CLAUDE.md points there.

Triggers: `pull_request` targeting `main`, and `workflow_dispatch`. There is no push-to-main, deployment or production provisioning trigger. All four jobs run independently on separate GitHub-hosted `ubuntu-24.04` VMs. Workflow/PR-ref concurrency does not cancel running verification; GitHub may replace older pending runs.

## Jobs and commands

Each job checks out without persistent credentials, installs Node **24.22.1 LTS**, caches npm downloads keyed by `package-lock.json`, runs `npm ci`, then `npx --no-install prisma generate`. Client generation does not require a live database. Official checkout v7.0.1 and setup-node v7.1.0 are pinned to verified commit SHAs.

| Job ID / required check | Subsequent commands | Job budget |
| --- | --- | --- |
| `quality` / **Code Quality** | `npm run architecture:check`, `npm run lint:strict`, `npx --no-install next typegen`, `npm run typecheck` | 20 minutes |
| `unit` / **Unit Tests** | `npm run test` | 30 minutes |
| `integration` / **Full MySQL Integration** | Docker diagnostics; `node scripts/run-mysql-integration-tests.mjs --verify-failure-cleanup`; `npm run test:integration:mysql`; always `node scripts/run-mysql-integration-tests.mjs --cleanup` | 60 minutes |
| `build` / **Production Build** | `npm run build` | 30 minutes |

Budgets bound setup plus execution; they do not change test deadlines. Initial/final diagnostics show CPU, memory, disk and tool versions without environment dumps. There are no retries, suppressed failures or `continue-on-error` steps.

Quality generates Next.js types before standalone TypeScript checking. A clean checkout has no ignored `next-env.d.ts`, so image imports otherwise fail with TS2307; the initial hosted run and an isolated local checkout reproduced this. `next typegen` generates Next's own declarations without a build. Existing developer/build-generated files can conceal this prerequisite. No custom wildcard declaration or relaxed compiler rule is used.

Default Vitest discovery/configuration is unchanged: node, RSC, DOM and architecture projects in `vitest.config.ts`. Integration uses `vitest.integration.config.ts`: `__tests__/integration` and IT/Leave/Stock integration directories, serial files, one worker and existing 20-second test/hook deadlines. The unit job excludes these database tests. The new safety tests run in the default node project.

The first hosted unit run exposed pre-existing developer-environment dependencies, reproduced with focused tests in a checkout without `.env`: LIFF Leave adapter and authorization administration fixtures used a live authorization repository, the LINE retry fixture omitted its Stock token, and a date-format expectation assumed Bangkok local time. These tests now inject empty in-memory grant repositories into the real resolver, supply the synthetic Stock token beside the existing mocked fetch, and scope/restore Bangkok timezone for the Thai timestamp test. Original assertions remain intact; no production resolver, authorization rule, formatter or provider behavior changes. Unit verification needs no live database/provider credentials.

No migration integrity/order script exists in NHF. CI does not claim a separate historical migration checksum/order audit. The integration job actually applies all committed migrations to a fresh empty database through `prisma migrate deploy`, retaining the routine-recipient SQL contract coverage. Do not modify historical production migrations to repair CI.

## Disposable MySQL lifecycle and boundaries

`npm run test:integration:mysql` now owns startup and teardown; do not manually prestart a database or export `TEST_DATABASE_URL`. It requires Docker Engine and Compose v2, Node 24 and installed dependencies. The runner does not load `integration.env` or accept its externally supplied URL. `integration.env.example` supplies only the explicit Compose env-file context; the runner overrides every MySQL setting with its own disposable configuration.

1. Allocate a project `nhf-integration-<run-id>-<attempt>` in CI, or a random project locally. The failure probe uses a separate `-probe` project. Generate synthetic random credentials; keep database `employee_nhf_integration` and account `integration_user`.
2. Start the existing `docker-compose.integration.yml`: MySQL 8.0, tmpfs database storage, loopback-only randomly allocated host port. `up --detach --wait --wait-timeout 120` waits for TCP health; TCP avoids accepting the image's temporary socket-only initialization server.
3. Discover the project's published endpoint. Read `@@server_uuid` inside its own container using root only for this read. Connect through the host endpoint as the restricted database account, and verify the same live UUID, database and `CURRENT_USER()` identity. No suffix-only trust.
4. Override both `DATABASE_URL` and `TEST_DATABASE_URL` with the same generated URL and set `NODE_ENV=test`. Reject remote/alternate hosts, databases, accounts, query/socket overrides, missing identity and mismatching URLs before SQL. Existing application `DATABASE_URL` cannot select the test target. Prisma uses the explicit child environment rather than the application's `.env` URL.
5. Generate Prisma Client; run the existing routine-recipient migration SQL coverage; apply committed Prisma migrations; run the full existing integration suite. The SQL coverage script rechecks live identity. Vitest global setup rechecks identity before importing integration test files, including when someone invokes the config directly.
6. In `finally`, run project-scoped `down --volumes --remove-orphans`, then assert no project containers remain. Log only project/phase/result, never credentials. Preserve the original failed command's exit code if teardown also fails; a teardown failure after successful tests fails the command.

The CI failure probe intentionally fails with exit 37 after real startup/identity validation and accepts that expected result only if cleanup succeeds. It runs no application tests/migrations. Unit safety tests cover unsafe targets, live identity mismatch, startup/command failures, success teardown, and simultaneous test/cleanup failure ordering. The normal full integration run establishes migrations/tests and success cleanup. CI has a separate `always()` cleanup step for both run-specific projects, including failures before tests. Forced VM termination can prevent cleanup; the hosted VM and tmpfs remain ephemeral. Local abrupt termination may need manual removal of the exact logged project using the same Compose file; never remove application projects.

These are safeguards for trusted repository test tooling, not a sandbox against malicious code with Docker control. No production DB, LINE, Cloudflare, SMTP or other service credentials are supplied. Only `contents: read` is granted to GITHUB_TOKEN; PR code runs under `pull_request`, never `pull_request_target`. No DB state, raw database logs or build artifacts are uploaded. The existing MySQL tag and hosted runner image can change upstream; they are not immutable OS images.

## Build configuration

Build initially uses no application secrets or synthetic application configuration and no extra heap limit. Prisma construction is lazy with respect to connecting; request-only validators remain unchanged. This workflow does not seed or contact a production database, invoke notification provisioning, disable authorization, or change feature flags. If hosted build exposes a configuration requirement, diagnose the exact failure and document any safe synthetic build-only value before adding it. No build output is deployed. Dependency/font downloads may need internet; this is not an offline build.

## Local feedback and hosted evidence

During development use affected tests, for example `npm run test -- __tests__/scripts/mysql-integration-safety.test.mjs`, targeted lint, and architecture/type checks as appropriate. Full local regression/build requires a documented exceptional reason under AGENTS.md; hosted CI is the default full gate. Docker is absent on the initial Windows workstation, so real lifecycle execution must be established on hosted CI, not inferred from mocks.

When CI fails, open the failed job and original step logs. Identify the exact assertion/command/migration/build error. Classify infrastructure, configuration, portability, fixtures, resource contention and deterministic application failures separately. Reproduce the smallest relevant case, fix the evidenced cause, verify locally with focused checks, and push to the same branch/PR. Do not increase deadlines, add arbitrary retries, weaken assertions or skip tests. For Docker startup failures, inspect Compose availability and health; for identity failures recreate only the disposable project. For migration failures preserve the original Prisma error. For timeouts compare diagnostics and isolate the affected test; snapshots alone cannot prove the cause. Keep cleanup failures visible separately from test failures.

## Draft PR, manual runs and current HEAD

Open a Draft PR against `main` after focused checks. Inspect all four actual check conclusions for the latest PR head SHA, not just the workflow badge. GitHub pull-request checkout tests a merge ref; record both run `head_sha` (PR head) and checkout/merge context when investigating differences. After each commit, earlier successes no longer establish readiness. Record run URL, tested head SHA, each job result, unit/integration file/test totals from Vitest, and cleanup outcome from both the runner and always-cleanup step.

Use `CI PENDING`, `READY FOR REVIEW`, `REQUEST CHANGES` and `BLOCKED` exactly as defined in AGENTS.md. Failed/skipped/cancelled/unverified required jobs block readiness. Keep the PR unmerged for engineering review and owner approval. Do not enable auto-merge.

For manual runs: **Actions → NHF Employee CI → Run workflow → choose branch**. Alternatively `gh workflow run ci.yml --ref <task-branch>`. GitHub requires the dispatchable workflow on the default branch, appropriate permissions, available quota and enabled Actions; the initial PR runs through its PR trigger before merge. Verify the selected run's SHA matches the current PR HEAD. Jobs may queue for runner/account capacity or fork approval.

Technical CI success establishes executed checks only. Engineering review approves implementation quality; business/UAT acceptance requires separate user-flow evidence; production deployment requires separate owner authorization and the existing deployment/acceptance runbooks. None is implied by another. This pipeline does not execute E2E/UAT or a production security assessment.

## Protection assessment and owner actions

Read-only assessment on 2026-11-08: GitHub CLI reported `main` **not protected** (protection endpoint 404, `Branch not protected`), repository rulesets `[]`, public visibility, and `allow_auto_merge: false`. The connected GitHub App could not read protection (403), so the authenticated owner's CLI was used to verify. No settings were changed. Recheck actual settings before configuration; they can change independently.

After this workflow is reviewed and merged and all four checks are available, the owner must:

1. Open **Settings → Rules → Rulesets**, create/activate a branch ruleset targeting `main` (or an equivalent branch protection rule under **Settings → Branches**).
2. Require a pull request before merging; set required engineering review/approval policy appropriate to owner governance. Dismiss stale approvals or require approval of the most recent reviewable push so later changes receive review.
3. Require successful status checks from GitHub Actions with these exact reported names: **Code Quality**, **Unit Tests**, **Full MySQL Integration**, **Production Build**. Verify names/source in PR Checks first. Require branches up to date before merging so checks cover the current merge context; require all checks again on new commits.
4. Prevent normal direct pushes to `main`, force pushes and deletions. Apply enforcement to administrators where supported; leave automated agents, GitHub Apps and normal actors off bypass lists. Do not configure an agent merge bypass. Owner approval must precede a deliberate merge through the PR.
5. Keep automatic merging disabled. Verify effective repository and inherited organization rules, bypass actors and merge permissions using a non-owner/agent identity where possible. Do not assume a written agent rule enforces server-side protection.

Availability depends on repository plan/permissions. This task provides assessment and instructions only; owner configuration remains pending. Required checks alone do not encode business acceptance or owner authorization.

## Official references

- [GitHub Actions security](https://docs.github.com/en/actions/reference/security/secure-use), [checkout](https://github.com/actions/checkout), [setup-node](https://github.com/actions/setup-node).
- [Node LTS releases](https://nodejs.org/en/about/previous-releases), [hosted runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).
- [Docker Compose up](https://docs.docker.com/reference/cli/docker/compose/up/), [down](https://docs.docker.com/reference/cli/docker/compose/down/).
- [Prisma CLI](https://www.prisma.io/docs/orm/reference/prisma-cli-reference), [environment variables](https://www.prisma.io/docs/orm/more/development-environment/environment-variables).
- [Manual workflows](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow), [rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets).
