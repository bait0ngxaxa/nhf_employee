import { Role } from "@prisma/client";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("User role persistence", () => {
    it("defines and exposes the Role enum", async () => {
        const schema = await readFile("prisma/schema.prisma", "utf8");

        expect(schema).toContain("enum Role {");
        expect(schema).toMatch(/role\s+Role\s+@default\(USER\)/);
        expect(Role).toEqual({ USER: "USER", ADMIN: "ADMIN" });
    });
});
