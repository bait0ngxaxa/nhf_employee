import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

const BASE_EXCLUDES = [
    "node_modules",
    ".next",
    ".git",
    "__tests__/integration/**",
    "modules/stock/__tests__/integration/**",
];

const NODE_TESTS = [
    "__tests__/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
    "modules/stock/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
];

const DOM_TESTS = [
    "__tests__/**/*.{test,spec}.{jsx,mjsx,cjsx,tsx,mtsx,ctsx}",
    "__tests__/{components,hooks,context}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}",
];

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        setupFiles: "./vitest.setup.ts",
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
                    include: [...DOM_TESTS],
                },
            },
        ],
    },
});
