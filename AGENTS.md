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

<!-- NEXT-AGENTS-MD-START -->[Next.js Docs Index]|root: ./node_modules/next/dist/docs|STOP. What you remember about Next.js is WRONG for this project. Always search docs and read before any task.|If docs missing, run this command first: npx @next/codemod agents-md --output AGENTS.md|01-app:{04-glossary.md}|01-app/01-getting-started:{01-installation.md,02-project-structure.md,03-layouts-and-pages.md,04-linking-and-navigating.md,05-server-and-client-components.md,06-fetching-data.md,07-mutating-data.md,08-caching.md,09-revalidating.md,10-error-handling.md,11-css.md,12-images.md,13-fonts.md,14-metadata-and-og-images.md,15-route-handlers.md,16-proxy.md,17-deploying.md,18-upgrading.md}|01-app/02-guides:{adopting-partial-prefetching.md,ai-agents.md,analytics.md,authentication.md,authentication-with-cache-components.md,backend-for-frontend.md,building.md,caching-without-cache-components.md,cdn-caching.md,ci-build-caching.md,content-security-policy.md,css-in-js.md,custom-server.md,data-security.md,debugging.md,deploying-to-platforms.md,draft-mode.md,environment-variables.md,forms.md,how-revalidation-works.md,incremental-static-regeneration-cache-components.md,incremental-static-regeneration.md,instant-navigation.md,instrumentation.md,interactive-apps.md,internationalization.md,json-ld.md,lazy-loading.md,local-development.md,mcp.md,mdx.md,memory-usage.md,migrating-to-cache-components.md,multi-tenant.md,multi-zones.md,offline-support.md,open-telemetry.md,optimizing-prefetching.md,package-bundling.md,ppr-platform-guide.md,prefetching.md,preserving-ui-state.md,preventing-flash-before-hydration.md,production-checklist.md,progressive-web-apps.md,public-static-pages.md,redirecting.md,rendering-philosophy.md,sass.md,scripts.md,self-hosting.md,server-actions.md,server-and-client-boundary.md,single-page-applications.md,static-exports.md,streaming.md,tailwind-v3-css.md,third-party-libraries.md,videos.md,view-transitions.md}|01-app/02-guides/client-side-data-fetching:{swr.md,tanstack-query.md}|01-app/02-guides/migrating:{app-router-migration.md,from-create-react-app.md,from-vite.md}|01-app/02-guides/testing:{cypress.md,jest.md,playwright.md,vitest.md}|01-app/02-guides/upgrading:{codemods.md,version-14.md,version-15.md,version-16.md}|01-app/03-api-reference:{07-edge.md,08-turbopack.md}|01-app/03-api-reference/01-directives:{use-cache-private.md,use-cache-remote.md,use-cache.md,use-client.md,use-server.md}|01-app/03-api-reference/02-components:{font.md,form.md,image.md,link.md,script.md}|01-app/03-api-reference/03-file-conventions/01-metadata:{app-icons.md,manifest.md,opengraph-image.md,robots.md,sitemap.md}|01-app/03-api-reference/03-file-conventions/02-route-segment-config:{dynamicParams.md,instant.md,maxDuration.md,preferredRegion.md,prefetch.md,runtime.md}|01-app/03-api-reference/03-file-conventions:{default.md,dynamic-routes.md,error.md,forbidden.md,instrumentation-client.md,instrumentation.md,intercepting-routes.md,layout.md,loading.md,mdx-components.md,middleware.md,not-found.md,page.md,parallel-routes.md,proxy.md,public-folder.md,route-groups.md,route.md,src-folder.md,template.md,unauthorized.md}|01-app/03-api-reference/04-functions:{after.md,cacheLife.md,cacheTag.md,catchError.md,connection.md,cookies.md,draft-mode.md,fetch.md,forbidden.md,generate-image-metadata.md,generate-metadata.md,generate-sitemaps.md,generate-static-params.md,generate-viewport.md,headers.md,image-response.md,io.md,next-request.md,next-response.md,next-root-params.md,not-found.md,permanentRedirect.md,redirect.md,refresh.md,revalidatePath.md,revalidateTag.md,unauthorized.md,unstable_cache.md,unstable_noStore.md,unstable_rethrow.md,updateTag.md,use-link-status.md,use-offline.md,use-params.md,use-pathname.md,use-report-web-vitals.md,use-router.md,use-search-params.md,use-selected-layout-segment.md,use-selected-layout-segments.md,userAgent.md}|01-app/03-api-reference/05-config/01-next-config-js:{adapterPath.md,allowedDevOrigins.md,appDir.md,assetPrefix.md,authInterrupts.md,basePath.md,cacheComponents.md,cacheHandlers.md,cacheLife.md,cacheMaxMemorySize.md,compress.md,crossOrigin.md,cssChunking.md,deploymentId.md,devIndicators.md,distDir.md,env.md,expireTime.md,exportPathMap.md,generateBuildId.md,generateEtags.md,headers.md,htmlLimitedBots.md,httpAgentOptions.md,images.md,incrementalCacheHandlerPath.md,inlineCss.md,instrumentationClientInject.md,logging.md,mdxRs.md,onDemandEntries.md,optimizePackageImports.md,output.md,outputHashSalt.md,pageExtensions.md,partialPrefetching.md,poweredByHeader.md,prefetchInlining.md,productionBrowserSourceMaps.md,proxyClientMaxBodySize.md,reactCompiler.md,reactMaxHeadersLength.md,reactStrictMode.md,redirects.md,rewrites.md,sassOptions.md,serverActions.md,serverComponentsHmrCache.md,serverExternalPackages.md,staleTimes.md,staticGeneration.md,supportsImmutableAssets.md,taint.md,trailingSlash.md,transpilePackages.md,turbopack.md,turbopackChunking.md,turbopackFileSystemCache.md,turbopackIgnoreIssue.md,turbopackLocalPostcssConfig.md,turbopackMemoryEviction.md,turbopackRustReactCompiler.md,typedRoutes.md,typescript.md,urlImports.md,useLightningcss.md,useOffline.md,useTypeScriptCli.md,webVitalsAttribution.md,webpack.md}|01-app/03-api-reference/05-config:{02-typescript.md,03-eslint.md}|01-app/03-api-reference/06-cli:{create-next-app.md,next.md}|01-app/03-api-reference/07-adapters:{01-configuration.md,02-creating-an-adapter.md,03-api-reference.md,04-testing-adapters.md,05-routing-with-next-routing.md,06-implementing-ppr-in-an-adapter.md,07-runtime-integration.md,08-invoking-entrypoints.md,09-output-types.md,10-routing-information.md,11-use-cases.md,12-immutable-static-assets.md}|02-pages/01-getting-started:{01-installation.md,02-project-structure.md,04-images.md,05-fonts.md,06-css.md,11-deploying.md}|02-pages/02-guides:{analytics.md,authentication.md,babel.md,ci-build-caching.md,content-security-policy.md,css-in-js.md,custom-server.md,debugging.md,draft-mode.md,environment-variables.md,forms.md,incremental-static-regeneration.md,instrumentation.md,internationalization.md,lazy-loading.md,mdx.md,multi-zones.md,open-telemetry.md,package-bundling.md,post-css.md,preview-mode.md,production-checklist.md,redirecting.md,sass.md,scripts.md,self-hosting.md,static-exports.md,tailwind-v3-css.md,third-party-libraries.md}|02-pages/02-guides/migrating:{app-router-migration.md,from-create-react-app.md,from-vite.md}|02-pages/02-guides/testing:{cypress.md,jest.md,playwright.md,vitest.md}|02-pages/02-guides/upgrading:{codemods.md,version-10.md,version-11.md,version-12.md,version-13.md,version-14.md,version-9.md}|02-pages/03-building-your-application/01-routing:{01-pages-and-layouts.md,02-dynamic-routes.md,03-linking-and-navigating.md,05-custom-app.md,06-custom-document.md,07-api-routes.md,08-custom-error.md}|02-pages/03-building-your-application/02-rendering:{01-server-side-rendering.md,02-static-site-generation.md,04-automatic-static-optimization.md,05-client-side-rendering.md}|02-pages/03-building-your-application/03-data-fetching:{01-get-static-props.md,02-get-static-paths.md,03-get-server-side-props.md,05-client-side.md}|02-pages/03-building-your-application/06-configuring:{12-error-handling.md}|02-pages/04-api-reference:{06-edge.md,08-turbopack.md}|02-pages/04-api-reference/01-components:{font.md,form.md,head.md,image-legacy.md,image.md,link.md,script.md}|02-pages/04-api-reference/02-file-conventions:{instrumentation.md,proxy.md,public-folder.md,src-folder.md}|02-pages/04-api-reference/03-functions:{catchError.md,get-initial-props.md,get-server-side-props.md,get-static-paths.md,get-static-props.md,next-request.md,next-response.md,use-params.md,use-report-web-vitals.md,use-router.md,use-search-params.md,userAgent.md}|02-pages/04-api-reference/04-config/01-next-config-js:{adapterPath.md,allowedDevOrigins.md,assetPrefix.md,basePath.md,bundlePagesRouterDependencies.md,compress.md,crossOrigin.md,deploymentId.md,devIndicators.md,distDir.md,env.md,exportPathMap.md,generateBuildId.md,generateEtags.md,headers.md,httpAgentOptions.md,images.md,logging.md,onDemandEntries.md,optimizePackageImports.md,output.md,pageExtensions.md,poweredByHeader.md,productionBrowserSourceMaps.md,proxyClientMaxBodySize.md,reactStrictMode.md,redirects.md,rewrites.md,serverExternalPackages.md,trailingSlash.md,transpilePackages.md,turbopack.md,turbopackChunking.md,typescript.md,urlImports.md,useLightningcss.md,useTypeScriptCli.md,webVitalsAttribution.md,webpack.md}|02-pages/04-api-reference/04-config:{01-typescript.md,02-eslint.md}|02-pages/04-api-reference/05-cli:{create-next-app.md,next.md}|02-pages/04-api-reference/06-adapters:{01-configuration.md,02-creating-an-adapter.md,03-api-reference.md,04-testing-adapters.md,05-routing-with-next-routing.md,06-runtime-integration.md,07-invoking-entrypoints.md,08-output-types.md,09-routing-information.md,10-use-cases.md}|03-architecture:{accessibility.md,fast-refresh.md,nextjs-compiler.md,supported-browsers.md}|04-community:{01-contribution-guide.md,02-rspack.md}<!-- NEXT-AGENTS-MD-END -->
