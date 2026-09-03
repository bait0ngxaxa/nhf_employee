import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { checkArchitecture } from "../../scripts/check-architecture.mjs";

type FixtureFiles = Readonly<Record<string, string>>;

const fixtureFiles: FixtureFiles = {
    "modules/stock/index.ts": "export const x = 1;\n",
    "modules/stock/application/create-item.ts": "export const x = 1;\n",
    "modules/stock/domain/inventory.ts": "export const x = 1;\n",
    "modules/routine/index.ts": "export const x = 1;\n",
    "modules/routine/application/example.ts": "export const x = 1;\n",
    "shared/index.ts": "export const x = 1;\n",
};

const temporaryRoots: string[] = [];

async function createFixture(files: FixtureFiles): Promise<string> {
    const rootPath = await mkdtemp(path.join(os.tmpdir(), "nhf-architecture-check-"));
    temporaryRoots.push(rootPath);

    for (const [filePath, contents] of Object.entries(files)) {
        const absolutePath = path.join(rootPath, ...filePath.split("/"));
        await mkdir(path.dirname(absolutePath), { recursive: true });
        await writeFile(absolutePath, contents, "utf8");
    }

    return rootPath;
}

async function checkFixture(
    importerPath: string,
    importSource: string,
): Promise<{ sourceFiles: string[]; violations: string[] }> {
    const rootPath = await createFixture({
        ...fixtureFiles,
        [importerPath]: importSource,
    });

    return checkArchitecture({ repositoryRoot: rootPath });
}

afterEach(async () => {
    const rootsToRemove = temporaryRoots.splice(0);
    await Promise.all(
        rootsToRemove.map((rootPath) => rm(rootPath, { recursive: true, force: true })),
    );
});

describe("architecture checker module boundaries", () => {
    it("allows an external consumer to use a module public API", async () => {
        const result = await checkFixture(
            "app/example.ts",
            'import { x } from "@/modules/stock";\n',
        );

        expect(result.violations).toEqual([]);
    });

    it("rejects an external consumer deep-importing module internals", async () => {
        const result = await checkFixture(
            "app/example.ts",
            'import { x } from "@/modules/stock/application/create-item";\n',
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            'external consumers must use the target module public API "@/modules/stock"',
        );
    });

    it("allows a module to use another module public API", async () => {
        const result = await checkFixture(
            "modules/routine/example.ts",
            'import { x } from "@/modules/stock";\n',
        );

        expect(result.violations).toEqual([]);
    });

    it("rejects a module deep-importing another module internals", async () => {
        const result = await checkFixture(
            "modules/routine/example.ts",
            'import { x } from "@/modules/stock/domain/inventory";\n',
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            'cross-module dependencies must use the target module public entry point "@/modules/stock"',
        );
    });

    it("allows a module to use its own internal implementation", async () => {
        const result = await checkFixture(
            "modules/stock/application/example.ts",
            'import { x } from "@/modules/stock/domain/inventory";\n',
        );

        expect(result.violations).toEqual([]);
    });

    it("rejects shared code importing a module public API", async () => {
        const result = await checkFixture(
            "shared/example.ts",
            'import { x } from "@/modules/stock";\n',
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "shared/ cannot depend on business modules",
        );
    });

    it("rejects shared code importing module internals", async () => {
        const result = await checkFixture(
            "shared/example.ts",
            'import { x } from "@/modules/stock/domain/inventory";\n',
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "shared/ cannot depend on business modules",
        );
    });

    it("rejects a relative cross-module deep import", async () => {
        const result = await checkFixture(
            "modules/routine/application/example.ts",
            'import { x } from "../../stock/domain/inventory";\n',
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            'imports "../../stock/domain/inventory"',
        );
    });
});
