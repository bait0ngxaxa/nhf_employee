# AGENTS.md

## 1. Priorities and Scope

* Priority order: **Correctness > Security > Maintainability > Performance > Speed**
* Make the smallest necessary change and keep it consistent with the existing architecture.
* Read the relevant code before making changes. Do not infer behavior from file names or function names.
* Do not modify files outside the task scope, rewrite code unnecessarily, or revert existing user changes.
* UI/style work must not change business logic unless explicitly instructed.

## 2. Thai Text and Encoding

* **Thai text must never become corrupted, lost, translated, or mojibake.**
* Preserve the existing file encoding, BOM, and line endings.
* New text files must use **UTF-8 without BOM** unless the repository specifies otherwise.
* When using PowerShell, always specify encoding explicitly when reading or writing files, for example:

```powershell
Get-Content -Raw -Encoding UTF8

Set-Content -Encoding utf8NoBOM
```

* Never overwrite files containing Thai text using commands that rely on default encoding.
* Inspect `git diff` after making changes to detect corrupted characters such as `�`, malformed Thai text, or unintended whole-file encoding changes.
* Do not translate Thai text into English unless explicitly authorized.

## 3. Documentation and Repository Context

* Review project instructions, types, tests, schemas, and existing implementations before creating anything new.
* Treat existing repository implementations and conventions as the primary source of truth.
* When using APIs or behavior from external libraries, verify the latest documentation through **Context7 MCP** or official documentation.
* Do not guess APIs, configuration options, framework behavior, or package versions.
* If documentation is unclear, state the assumption and choose the approach with the smallest impact.
* UI/UX work must use the **Impeccable skill** and follow the project's existing design system.

## 4. Code Quality and Type Safety

* Deliver complete implementations. Do not use placeholders such as `// ...`, pseudo-code, or empty functions.
* Prefer reuse before introducing new abstractions or implementations.
* Apply SRP, DRY, KISS, early returns, and pure functions where appropriate.
* Avoid unnecessary mutation.
* Newly modified first-party code must not introduce `any`.
* Use `unknown` together with schema validation or type guards.
* Define explicit return types for exported functions, services, hooks, actions, and API handlers.
* Handle `null` and `undefined` explicitly. Do not use non-null assertions without supporting evidence.
* Do not modify generated code or vendor code merely to bypass type errors.

## 5. Validation, Security, and Errors

* Validate input at every system boundary, including APIs, server actions, forms, webhooks, and environment variables.
* Use schemas as the Single Source of Truth and derive types from schemas whenever possible.
* Enforce authentication and authorization on the server for every mutation.
* Never trust roles, owner IDs, or permissions supplied by the client.
* Do not hardcode secrets, credentials, tokens, or sensitive configuration.
* Do not expose stack traces, SQL errors, internal paths, or implementation details to clients.
* Client-facing errors must be safe and understandable. Technical details should be recorded in server logs.

Standard order for server-side mutations:

1. Request size / abuse protection / rate limiting
2. Authentication
3. Input parsing and schema validation
4. Resource-level authorization
5. Business rules
6. Transactional persistence
7. Cache invalidation or revalidation
8. Sanitized response

## 6. Architecture and Single Source of Truth

* Types, constants, validation schemas, and business rules must each have a single authoritative source.
* Dependency direction:

```text
UI → Hooks → Services → Data Layer
```

* Lower layers must not import from higher layers.
* UI code must not access the database or persistence implementation directly.
* Business logic shared across multiple entry points must live in the service/domain layer rather than being duplicated in routes or components.
* Avoid circular dependencies and hidden side effects.

## 7. API and Database

* Public APIs intended for long-term support should use versioned endpoints.
* Use cursor-based pagination for datasets that may grow significantly.
* Mutations that may be retried, submitted more than once, or have significant side effects must define clear idempotency semantics.
* Never construct SQL from user input using string concatenation.
* Use parameterized queries or ORM query APIs only.
* Raw SQL must not use `SELECT *`; select only the required fields.
* Use transactions when multiple operations must either succeed or fail together.
* Production schema changes must be applied through migrations only.
* Enforce uniqueness, foreign keys, and concurrency constraints at the database layer when they represent business invariants.

## 8. Performance and Reliability

* Avoid accidental `O(n²)` behavior, N+1 queries, and repeated database or network calls.
* Use `Map` or `Set` for repeated lookups when appropriate for the dataset size.
* Use `Promise.all` only for operations that are independent and safe to execute concurrently.
* Do not parallelize operations that have dependencies, transaction ordering requirements, or shared mutable state.
* Use caching only when ownership, TTL, invalidation, and consistency behavior are clearly defined.
* Use dynamic imports only for dependencies that are large, unnecessary on the initial path, and provide measurable benefit.
* Retry only transient failures and operations that are safe to retry.
* Retries must have a maximum attempt count, exponential backoff, and jitter.
* Do not optimize based on speculation for code paths that are not known hot paths.

## 9. Testing and Verification

Run only checks relevant to the change:

1. Lint
2. Typecheck
3. Targeted tests
4. Broader test suites when regression risk is high

* Prefer scripts defined by the repository.
* Do not build or run the development server unless explicitly requested, required to reproduce an issue, or there is no other reasonable verification method.
* Tests must verify behavior rather than implementation details.
* Use unit tests for business rules and pure logic.
* Use integration tests for database interactions, authorization, and critical mutations.
* Use E2E tests for critical user flows, including both happy paths and error paths.
* Do not modify tests merely to make them pass without verifying that the expected behavior is still correct.
* If a command cannot be run, state the command, the reason, and what remains unverified.

## 10. Git and Delivery

* Inspect `git status` and `git diff` before and after making changes.
* Do not use destructive Git commands, force pushes, or reset user work without explicit authorization.
* Do not modify lockfiles, generated files, or format the entire repository unless required by the task.
* Keep diffs small, readable, and clearly separated by concern.
* Before completing the task, summarize:

  * Files changed
  * Behavior changed
  * Important security or architecture decisions
  * Commands and tests executed, including results
  * Remaining limitations, assumptions, or risks

<!-- NEXT-AGENTS-MD-START -->[Next.js Docs Index]|root: ./.next-docs|STOP. What you remember about Next.js is WRONG for this project. Always search docs and read before any task.|If docs missing, run this command first: npx @next/codemod agents-md --output AGENTS.md|01-app/01-getting-started:{01-installation.mdx,02-project-structure.mdx,03-layouts-and-pages.mdx,04-linking-and-navigating.mdx,05-server-and-client-components.mdx,06-partial-prerendering.mdx,07-fetching-data.mdx,08-updating-data.mdx,09-caching-and-revalidating.mdx,10-error-handling.mdx,11-css.mdx,12-images.mdx,13-fonts.mdx,14-metadata-and-og-images.mdx,15-route-handlers-and-middleware.mdx,16-deploying.mdx,17-upgrading.mdx}|01-app/02-guides:{analytics.mdx,authentication.mdx,backend-for-frontend.mdx,caching.mdx,ci-build-caching.mdx,content-security-policy.mdx,css-in-js.mdx,custom-server.mdx,data-security.mdx,debugging.mdx,draft-mode.mdx,environment-variables.mdx,forms.mdx,incremental-static-regeneration.mdx,instrumentation.mdx,internationalization.mdx,json-ld.mdx,lazy-loading.mdx,local-development.mdx,mdx.mdx,memory-usage.mdx,multi-tenant.mdx,multi-zones.mdx,open-telemetry.mdx,package-bundling.mdx,prefetching.mdx,production-checklist.mdx,progressive-web-apps.mdx,redirecting.mdx,sass.mdx,scripts.mdx,self-hosting.mdx,single-page-applications.mdx,static-exports.mdx,tailwind-v3-css.mdx,third-party-libraries.mdx,videos.mdx}|01-app/02-guides/migrating:{app-router-migration.mdx,from-create-react-app.mdx,from-vite.mdx}|01-app/02-guides/testing:{cypress.mdx,jest.mdx,playwright.mdx,vitest.mdx}|01-app/02-guides/upgrading:{codemods.mdx,version-14.mdx,version-15.mdx}|01-app/03-api-reference:{07-edge.mdx,08-turbopack.mdx}|01-app/03-api-reference/01-directives:{use-cache.mdx,use-client.mdx,use-server.mdx}|01-app/03-api-reference/02-components:{font.mdx,form.mdx,image.mdx,link.mdx,script.mdx}|01-app/03-api-reference/03-file-conventions/01-metadata:{app-icons.mdx,manifest.mdx,opengraph-image.mdx,robots.mdx,sitemap.mdx}|01-app/03-api-reference/03-file-conventions:{default.mdx,dynamic-routes.mdx,error.mdx,forbidden.mdx,instrumentation-client.mdx,instrumentation.mdx,intercepting-routes.mdx,layout.mdx,loading.mdx,mdx-components.mdx,middleware.mdx,not-found.mdx,page.mdx,parallel-routes.mdx,public-folder.mdx,route-groups.mdx,route-segment-config.mdx,route.mdx,src-folder.mdx,template.mdx,unauthorized.mdx}|01-app/03-api-reference/04-functions:{after.mdx,cacheLife.mdx,cacheTag.mdx,connection.mdx,cookies.mdx,draft-mode.mdx,fetch.mdx,forbidden.mdx,generate-image-metadata.mdx,generate-metadata.mdx,generate-sitemaps.mdx,generate-static-params.mdx,generate-viewport.mdx,headers.mdx,image-response.mdx,next-request.mdx,next-response.mdx,not-found.mdx,permanentRedirect.mdx,redirect.mdx,revalidatePath.mdx,revalidateTag.mdx,unauthorized.mdx,unstable_cache.mdx,unstable_noStore.mdx,unstable_rethrow.mdx,use-link-status.mdx,use-params.mdx,use-pathname.mdx,use-report-web-vitals.mdx,use-router.mdx,use-search-params.mdx,use-selected-layout-segment.mdx,use-selected-layout-segments.mdx,userAgent.mdx}|01-app/03-api-reference/05-config/01-next-config-js:{allowedDevOrigins.mdx,appDir.mdx,assetPrefix.mdx,authInterrupts.mdx,basePath.mdx,browserDebugInfoInTerminal.mdx,cacheComponents.mdx,cacheLife.mdx,compress.mdx,crossOrigin.mdx,cssChunking.mdx,devIndicators.mdx,distDir.mdx,env.mdx,eslint.mdx,expireTime.mdx,exportPathMap.mdx,generateBuildId.mdx,generateEtags.mdx,headers.mdx,htmlLimitedBots.mdx,httpAgentOptions.mdx,images.mdx,incrementalCacheHandlerPath.mdx,inlineCss.mdx,logging.mdx,mdxRs.mdx,middlewareClientMaxBodySize.mdx,onDemandEntries.mdx,optimizePackageImports.mdx,output.mdx,pageExtensions.mdx,poweredByHeader.mdx,ppr.mdx,productionBrowserSourceMaps.mdx,reactCompiler.mdx,reactMaxHeadersLength.mdx,reactStrictMode.mdx,redirects.mdx,rewrites.mdx,sassOptions.mdx,serverActions.mdx,serverComponentsHmrCache.mdx,serverExternalPackages.mdx,staleTimes.mdx,staticGeneration.mdx,taint.mdx,trailingSlash.mdx,transpilePackages.mdx,turbopack.mdx,turbopackPersistentCaching.mdx,typedRoutes.mdx,typescript.mdx,urlImports.mdx,useCache.mdx,useLightningcss.mdx,viewTransition.mdx,webVitalsAttribution.mdx,webpack.mdx}|01-app/03-api-reference/05-config:{02-typescript.mdx,03-eslint.mdx}|01-app/03-api-reference/06-cli:{create-next-app.mdx,next.mdx}|02-pages/01-getting-started:{01-installation.mdx,02-project-structure.mdx,04-images.mdx,05-fonts.mdx,06-css.mdx,11-deploying.mdx}|02-pages/02-guides:{amp.mdx,analytics.mdx,authentication.mdx,babel.mdx,ci-build-caching.mdx,content-security-policy.mdx,css-in-js.mdx,custom-server.mdx,debugging.mdx,draft-mode.mdx,environment-variables.mdx,forms.mdx,incremental-static-regeneration.mdx,instrumentation.mdx,internationalization.mdx,lazy-loading.mdx,mdx.mdx,multi-zones.mdx,open-telemetry.mdx,package-bundling.mdx,post-css.mdx,preview-mode.mdx,production-checklist.mdx,redirecting.mdx,sass.mdx,scripts.mdx,self-hosting.mdx,static-exports.mdx,tailwind-v3-css.mdx,third-party-libraries.mdx}|02-pages/02-guides/migrating:{app-router-migration.mdx,from-create-react-app.mdx,from-vite.mdx}|02-pages/02-guides/testing:{cypress.mdx,jest.mdx,playwright.mdx,vitest.mdx}|02-pages/02-guides/upgrading:{codemods.mdx,version-10.mdx,version-11.mdx,version-12.mdx,version-13.mdx,version-14.mdx,version-9.mdx}|02-pages/03-building-your-application/01-routing:{01-pages-and-layouts.mdx,02-dynamic-routes.mdx,03-linking-and-navigating.mdx,05-custom-app.mdx,06-custom-document.mdx,07-api-routes.mdx,08-custom-error.mdx}|02-pages/03-building-your-application/02-rendering:{01-server-side-rendering.mdx,02-static-site-generation.mdx,04-automatic-static-optimization.mdx,05-client-side-rendering.mdx}|02-pages/03-building-your-application/03-data-fetching:{01-get-static-props.mdx,02-get-static-paths.mdx,03-forms-and-mutations.mdx,03-get-server-side-props.mdx,05-client-side.mdx}|02-pages/03-building-your-application/06-configuring:{12-error-handling.mdx}|02-pages/04-api-reference:{06-edge.mdx,08-turbopack.mdx}|02-pages/04-api-reference/01-components:{font.mdx,form.mdx,head.mdx,image-legacy.mdx,image.mdx,link.mdx,script.mdx}|02-pages/04-api-reference/02-file-conventions:{instrumentation.mdx,middleware.mdx,public-folder.mdx,src-folder.mdx}|02-pages/04-api-reference/03-functions:{get-initial-props.mdx,get-server-side-props.mdx,get-static-paths.mdx,get-static-props.mdx,next-request.mdx,next-response.mdx,use-amp.mdx,use-report-web-vitals.mdx,use-router.mdx,userAgent.mdx}|02-pages/04-api-reference/04-config/01-next-config-js:{allowedDevOrigins.mdx,assetPrefix.mdx,basePath.mdx,bundlePagesRouterDependencies.mdx,compress.mdx,crossOrigin.mdx,devIndicators.mdx,distDir.mdx,env.mdx,eslint.mdx,exportPathMap.mdx,generateBuildId.mdx,generateEtags.mdx,headers.mdx,httpAgentOptions.mdx,images.mdx,middlewareClientMaxBodySize.mdx,onDemandEntries.mdx,optimizePackageImports.mdx,output.mdx,pageExtensions.mdx,poweredByHeader.mdx,productionBrowserSourceMaps.mdx,reactStrictMode.mdx,redirects.mdx,rewrites.mdx,runtime-configuration.mdx,serverExternalPackages.mdx,trailingSlash.mdx,transpilePackages.mdx,turbo.mdx,typescript.mdx,urlImports.mdx,useLightningcss.mdx,webVitalsAttribution.mdx,webpack.mdx}|02-pages/04-api-reference/04-config:{01-typescript.mdx,02-eslint.mdx}|02-pages/04-api-reference/05-cli:{create-next-app.mdx,next.mdx}|03-architecture:{accessibility.mdx,fast-refresh.mdx,nextjs-compiler.mdx,supported-browsers.mdx}|04-community:{01-contribution-guide.mdx,02-rspack.mdx}<!-- NEXT-AGENTS-MD-END -->
