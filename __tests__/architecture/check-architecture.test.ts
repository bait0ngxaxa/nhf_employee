import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { checkArchitecture } from "../../scripts/check-architecture.mjs";

type FixtureFiles = Readonly<Record<string, string>>;

const fixtureFiles: FixtureFiles = {
    "modules/stock/index.ts": "export const x = 1;\n",
    "modules/stock/client.ts": '"use client"; export const x = 1;\n',
    "modules/stock/application/create-item.ts": "export const x = 1;\n",
    "modules/stock/domain/inventory.ts": "export const x = 1;\n",
    "modules/routine/index.ts": "export const x = 1;\n",
    "modules/routine/application/example.ts": "export const x = 1;\n",
    "modules/future/index.ts": "export const x = 1;\n",
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
    const leavePresentationImporters = [
        "app/dashboard/leave/page.tsx",
        "app/dashboard/leave/loading.tsx",
        "app/liff/leave/page.tsx",
        "modules/leave/presentation/dashboard/Example.tsx",
        "modules/leave/presentation/liff/api.ts",
    ];

    it.each(leavePresentationImporters)("rejects legacy Leave presentation imports in %s", async (importerPath) => {
        const legacyPaths = [
            "components/dashboard/leave/LeaveRequestForm",
            "components/dashboard/sections/LeaveManagementSection",
            "components/liff/leave/LiffLeaveApp",
            "hooks/leave/useLeaveRequestFormModel",
            "hooks/useLeaveApprovals",
            "hooks/useLeaveProfile",
            "lib/client/liff-leave",
            "lib/services/leave/client",
            "lib/types/leave",
        ];
        const result = await checkFixture(importerPath, legacyPaths.map((target, index) =>
            `import { x as x${index} } from "@/${target}";`,
        ).join("\n"));

        expect(result.violations).toHaveLength(legacyPaths.length);
        expect(result.violations.every((message) => message.includes("legacy Leave ownership"))).toBe(true);
    });

    it.each([
        'export { x } from "../../../components/liff/leave/LiffLeaveApp.tsx";',
        'const x = import("../../../lib/client/liff-leave");',
        'const x = require("../../../hooks/useLeaveProfile");',
        'type X = import("../../../hooks/useLeaveApprovals").X;',
    ])("rejects relative legacy Leave dependencies: %s", async (source) => {
        const result = await checkFixture("app/liff/leave/page.tsx", source);
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain("legacy Leave ownership");
    });

    it.each(["@/modules/leave", "@/modules/leave/presentation/liff/LiffLeaveApp"])(
        "rejects the wrong Leave route entry %s", async (specifier) => {
            const result = await checkFixture("app/liff/leave/page.tsx", `import { x } from "${specifier}";`);
            expect(result.violations).toHaveLength(1);
            expect(result.violations[0]).toContain("routes must use @/modules/leave/client");
        },
    );

    it("allows Leave route composition and generic platform imports", async () => {
        const result = await checkFixture("app/dashboard/leave/page.tsx", [
            'import { x } from "@/modules/leave/client";',
            'import { y } from "@/components/ui/button";',
            'import { z } from "@/lib/client/liff";',
        ].join("\n"));
        expect(result.violations).toEqual([]);
    });

    it("rejects Leave presentation importing its own public barrel", async () => {
        const result = await checkFixture("modules/leave/presentation/liff/api.ts", 'import { x } from "../../client";');
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain("own public barrel");
    });

    it("rejects any Leave implementation importing its own public barrel", async () => {
        const result = await checkFixture(
            "modules/leave/domain/example.ts",
            'import { x } from "@/modules/leave";',
        );
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain("own public barrel");
    });

    it("rejects server-only runtime dependencies from the Leave client graph", async () => {
        const rootPath = await createFixture({
            ...fixtureFiles,
            "modules/leave/client.ts": 'import { x } from "@/lib/server/leave-api"; export { x };\n',
            "lib/server/leave-api.ts": "export const x = 1;\n",
        });
        const result = checkArchitecture({ repositoryRoot: rootPath });

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain("Server-only runtime dependency");
    });

    it("does not treat type-only Prisma contracts as client runtime dependencies", async () => {
        const rootPath = await createFixture({
            ...fixtureFiles,
            "modules/leave/client.ts": 'import type { Prisma } from "@prisma/client"; export type Select = Prisma.UserSelect;\n',
        });
        const result = checkArchitecture({ repositoryRoot: rootPath });

        expect(result.violations).toEqual([]);
    });

    it("rejects a transitive client-reachable import of the Leave server entry", async () => {
        const rootPath = await createFixture({
            ...fixtureFiles,
            "modules/leave/index.ts": "export const leaveServerContract = 1;\n",
            "modules/leave/client.ts": '"use client"; export const leaveClientContract = 1;\n',
            "components/ClientComponent.tsx": [
                '"use client";',
                'import { leaveServerContract } from "@/lib/leave-display";',
                "export const ClientComponent = () => leaveServerContract;",
            ].join("\n"),
            "lib/leave-display.ts": [
                'import { leaveServerContract } from "@/modules/leave";',
                "export { leaveServerContract };",
            ].join("\n"),
        });
        const result = checkArchitecture({ repositoryRoot: rootPath });

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "Client-reachable runtime code must not import the Leave server entry",
        );
    });

    it("allows a transitive client-reachable import of the Leave client entry", async () => {
        const rootPath = await createFixture({
            ...fixtureFiles,
            "modules/leave/index.ts": "export const leaveServerContract = 1;\n",
            "modules/leave/client.ts": '"use client"; export const leaveClientContract = 1;\n',
            "components/ClientComponent.tsx": [
                '"use client";',
                'import { leaveClientContract } from "@/lib/leave-display";',
                "export const ClientComponent = () => leaveClientContract;",
            ].join("\n"),
            "lib/leave-display.ts": [
                'import { leaveClientContract } from "@/modules/leave/client";',
                "export { leaveClientContract };",
            ].join("\n"),
        });
        const result = checkArchitecture({ repositoryRoot: rootPath });

        expect(result.violations).toEqual([]);
    });

    it("allows an external consumer to use a module public API", async () => {
        const result = await checkFixture(
            "app/example.ts",
            'import { x } from "@/modules/stock";\n',
        );

        expect(result.violations).toEqual([]);
    });

    it("allows an external consumer to use the explicit client public API", async () => {
        const result = await checkFixture(
            "app/example.ts",
            'import { x } from "@/modules/stock/client";\n',
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

    it("allows a module to use another module client public API", async () => {
        const result = await checkFixture(
            "modules/routine/example.ts",
            'import { x } from "@/modules/stock/client";\n',
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

    it("allows a module to use its own client public API", async () => {
        const result = await checkFixture(
            "modules/stock/presentation/example.ts",
            'import { x } from "@/modules/stock/client";\n',
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

    it("rejects shared code importing a module client public API", async () => {
        const result = await checkFixture(
            "shared/example.ts",
            'import { x } from "@/modules/stock/client";\n',
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

    it("rejects an external test deep-mocking module internals", async () => {
        const result = await checkFixture(
            "__tests__/example.test.ts",
            'vi.mock("@/modules/leave/infrastructure/storage");\n',
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            'external consumers must use the target module public API "@/modules/leave"',
        );
    });

    it.each([
        "app/api/leave/example.ts",
        "app/api/line/leave/example.ts",
    ])("rejects %s importing legacy Leave ownership", async (importerPath) => {
        const result = await checkFixture(
            importerPath,
            'import { x } from "@/lib/services/leave/notifications";\n',
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "Leave API routes must use the Leave module public API",
        );
    });

    it.each([
        "app/api/leave/example.ts",
        "app/api/line/leave/example.ts",
    ])("rejects %s importing the Leave client entry", async (importerPath) => {
        const result = await checkFixture(
            importerPath,
            'import { x } from "@/modules/leave/client";\n',
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "Leave API routes must use the server entry",
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

    it.each(["stock", "routine", "future"])(
        "rejects %s importing the global Outbox Processor",
        async (moduleName) => {
            const result = await checkFixture(
                `modules/${moduleName}/application/requests/example.ts`,
                'import { processOutbox } from "@/lib/services/outbox/processor";\n',
            );

            expect(result.violations).toHaveLength(1);
            expect(result.violations[0]).toContain(
                "Business modules must not depend on the global Outbox Processor",
            );
        },
    );
});
