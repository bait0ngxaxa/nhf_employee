import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

const BASE_EXCLUDES = [
    "node_modules",
    ".next",
    ".git",
    "__tests__/integration/**",
    "modules/leave/__tests__/integration/**",
    "modules/stock/__tests__/integration/**",
];

const NODE_TESTS = [
        "__tests__/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
        "modules/auth/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
        "modules/authorization/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
        "modules/employee/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
    "modules/department/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
    "modules/audit/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
    "modules/notification/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
    "modules/stock/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
    "modules/routine/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
    "modules/leave/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
];

const DOM_TESTS = [
    "__tests__/**/*.{test,spec}.{jsx,mjsx,cjsx,tsx,mtsx,ctsx}",
    "__tests__/{components,hooks,context}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
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
];

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
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
                    exclude: [...DOM_TESTS],
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
        ],
    },
});
