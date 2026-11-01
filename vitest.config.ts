import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { availableParallelism } from "os";

/**
 * Vitest's run-mode default is `availableParallelism() - 1`, which counts SMT
 * threads. On a 4-core/8-thread machine that starts 7 workers, and the
 * CPU-bound jsdom calendar/form tests slowed ~3x uniformly until the slowest
 * ones crossed the 5s timeout. Measured on that machine:
 * 7 workers: 6 timeouts; 4: 1 timeout; 3: 0 (max 3.3s); 2: 0 (max 2.5s).
 * Use roughly one worker per physical core, leaving one core for the main
 * process. `--maxWorkers` on the CLI still overrides this.
 */
const MAX_TEST_WORKERS = Math.max(1, Math.floor(availableParallelism() / 2) - 1);

const BASE_EXCLUDES = [
    "node_modules",
    ".next",
    ".git",
    "__tests__/integration/**",
    "modules/it/__tests__/integration/**",
    "modules/leave/__tests__/integration/**",
    "modules/stock/__tests__/integration/**",
];

const NODE_TESTS = [
        "__tests__/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
        "modules/auth/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
        "modules/authorization/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
        "modules/it/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
        "modules/employee/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
    "modules/department/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
    "modules/audit/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
    "modules/notification/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
    "modules/stock/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
    "modules/routine/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
    "modules/leave/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
];

const DOM_TESTS = [
    "modules/announcements/presentation/**/*.{test,spec}.{jsx,mjsx,cjsx,tsx,mtsx,ctsx}",
    "__tests__/**/*.{test,spec}.{jsx,mjsx,cjsx,tsx,mtsx,ctsx}",
    "__tests__/{components,hooks,context}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
    "modules/stock/__tests__/**/*.{test,spec}.{jsx,mjsx,cjsx,tsx,mtsx,ctsx}",
    "modules/stock/presentation/dashboard/**/*.{test,spec}.{jsx,mjsx,cjsx,tsx,mtsx,ctsx}",
    "modules/stock/presentation/dashboard/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
    "modules/routine/presentation/**/*.{test,spec}.{jsx,mjsx,cjsx,tsx,mtsx,ctsx}",
    "modules/routine/presentation/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
    "modules/audit/presentation/**/*.{test,spec}.{jsx,mjsx,cjsx,tsx,mtsx,ctsx}",
    "modules/audit/presentation/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
    "modules/leave/presentation/**/*.{test,spec}.{jsx,mjsx,cjsx,tsx,mtsx,ctsx}",
    "modules/leave/presentation/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
    "modules/employee/presentation/**/*.{test,spec}.{jsx,mjsx,cjsx,tsx,mtsx,ctsx}",
    "modules/employee/presentation/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
    "modules/notification/presentation/**/*.{test,spec}.{jsx,mjsx,cjsx,tsx,mtsx,ctsx}",
    "modules/notification/presentation/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
    "modules/authorization/presentation/**/*.{test,spec}.{jsx,mjsx,cjsx,tsx,mtsx,ctsx}",
    "modules/authorization/presentation/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
    "modules/it/presentation/dashboard/**/*.{test,spec}.{jsx,mjsx,cjsx,tsx,mtsx,ctsx}",
    "modules/it/presentation/dashboard/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
    "modules/it/presentation/liff/**/*.{test,spec}.{jsx,mjsx,cjsx,tsx,mtsx,ctsx}",
];

const ARCHITECTURE_TEST = "__tests__/architecture/check-architecture.test.ts";

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        maxWorkers: MAX_TEST_WORKERS,
        env: {
            NEXT_PUBLIC_FEATURE_LEAVE: "true",
        },
        alias: {
            "@": resolve(__dirname, "./"),
        },
        exclude: BASE_EXCLUDES,
        projects: [
            {
                extends: true,
                test: {
                    name: "node",
                    environment: "node",
                    include: [...NODE_TESTS],
                    exclude: [
                        ...DOM_TESTS,
                        ARCHITECTURE_TEST,
                        "__tests__/auth/current-user-projection.test.ts",
                    ],
                },
            },
            {
                extends: true,
                test: {
                    name: "rsc",
                    environment: "node",
                    include: ["__tests__/auth/current-user-projection.test.ts"],
                    execArgv: ["--conditions=react-server"],
                },
            },
            {
                extends: true,
                test: {
                    name: "dom",
                    environment: "jsdom",
                    setupFiles: "./vitest.setup.ts",
                    include: [...DOM_TESTS],
                },
            },
            {
                extends: true,
                test: {
                    name: "architecture",
                    environment: "node",
                    include: [ARCHITECTURE_TEST],
                    fileParallelism: false,
                    sequence: { groupOrder: 1 },
                },
            },
        ],
    },
});
