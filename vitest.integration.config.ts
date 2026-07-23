import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: {
            "@": resolve(__dirname, "./"),
        },
    },
    test: {
        environment: "node",
        globals: true,
        include: ["__tests__/integration/**/*.integration.test.ts"],
        fileParallelism: false,
        maxWorkers: 1,
        testTimeout: 20_000,
        hookTimeout: 20_000,
    },
});
