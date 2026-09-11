import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Prisma seed client ownership", () => {
    it("uses the shared Prisma client for all seed operations", async () => {
        const source = await readFile("prisma/seed.ts", "utf8");

        expect(source).toContain('import { prisma } from "@/lib/db/prisma";');
        expect(source).not.toContain('import { PrismaClient } from "@prisma/client";');
        expect(source).not.toMatch(/new PrismaClient\s*\(/);
    });
});
