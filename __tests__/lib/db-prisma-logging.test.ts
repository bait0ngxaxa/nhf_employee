// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { prismaClientConstructor } = vi.hoisted(() => ({
    prismaClientConstructor: vi.fn(),
}));

vi.mock("@prisma/client", () => ({
    PrismaClient: class {
        constructor(options: unknown) {
            prismaClientConstructor(options);
        }
    },
}));

type PrismaGlobal = { prisma?: unknown };

describe("lib/db/prisma client logging", () => {
    beforeEach(() => {
        vi.resetModules();
        prismaClientConstructor.mockClear();
        delete (globalThis as PrismaGlobal).prisma;
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        delete (globalThis as PrismaGlobal).prisma;
    });

    it("logs exactly error and warn in production (never query or info)", async () => {
        vi.stubEnv("NODE_ENV", "production");

        await import("@/lib/db/prisma");

        expect(prismaClientConstructor).toHaveBeenCalledTimes(1);
        expect(prismaClientConstructor).toHaveBeenCalledWith({
            log: ["error", "warn"],
        });
    });

    it("keeps development logging unchanged at error only", async () => {
        vi.stubEnv("NODE_ENV", "development");

        await import("@/lib/db/prisma");

        expect(prismaClientConstructor).toHaveBeenCalledTimes(1);
        expect(prismaClientConstructor).toHaveBeenCalledWith({
            log: ["error"],
        });
    });
});
