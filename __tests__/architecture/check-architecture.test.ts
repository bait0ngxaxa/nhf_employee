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
    "modules/employee/index.ts": "export const x = 1;\n",
    "modules/employee/client.ts": '"use client"; export const x = 1;\n',
    "modules/employee/application/example.ts": "export const x = 1;\n",
    "modules/department/index.ts": "export const x = 1;\n",
    "modules/department/application/example.ts": "export const x = 1;\n",
    "modules/department/infrastructure/persistence/repository.ts": "export const x = 1;\n",
    "modules/audit/index.ts": "export const x = 1;\n",
    "modules/audit/client.ts": '"use client"; export const x = 1;\n',
    "modules/audit/application/example.ts": "export const x = 1;\n",
    "modules/audit/infrastructure/persistence/repository.ts": "export const x = 1;\n",
    "modules/notification/index.ts": "export const x = 1;\n",
    "modules/notification/client.ts": '"use client"; export const x = 1;\n',
    "modules/notification/application/example.ts": "export const x = 1;\n",
    "modules/notification/infrastructure/persistence/repository.ts": "export const x = 1;\n",
    "modules/auth/index.ts": "export const x = 1;\n",
    "modules/auth/client.ts": '"use client"; export const x = 1;\n',
    "modules/auth/presentation/example.ts": '"use client"; export const x = 1;\n',
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

    it("rejects Employee implementation importing its own public barrel", async () => {
        const result = await checkFixture(
            "modules/employee/domain/example.ts",
            'import { x } from "@/modules/employee";',
        );
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain("own public barrel");
    });

    it.each([
        "@/modules/leave",
        "@/modules/leave/application/approvals/offboarding-responsibilities",
    ])("rejects Employee implementation importing Leave %s", async (specifier) => {
        const result = await checkFixture(
            "modules/employee/application/example.ts",
            `import { x } from "${specifier}";`,
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "Employee module must not depend on Leave",
        );
    });

    it("allows an Employee route composition boundary to use both public module APIs", async () => {
        const result = await checkFixture(
            "app/api/employees/example.ts",
            [
                'import { updateEmployee } from "@/modules/employee";',
                'import { getEmployeeLeaveOffboardingBlockers } from "@/modules/leave";',
                "export { updateEmployee, getEmployeeLeaveOffboardingBlockers };",
            ].join("\n"),
        );

        expect(result.violations).toEqual([]);
    });

    it("rejects Employee API routes importing legacy Employee ownership", async () => {
        const result = await checkFixture(
            "app/api/employees/example.ts",
            'import { x } from "@/lib/services/employee";',
        );
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain("Employee API routes must use");
    });

    it.each([
        "@/types/employees",
        "@/constants/employees",
        "@/lib/helpers/employee-helpers",
        "@/lib/helpers/csv-helpers",
        "@/hooks/useCSVImport",
        "@/components/employee/EditStatusModal",
    ])("rejects imports of deleted Employee compatibility path %s", async (specifier) => {
        const result = await checkFixture(
            "app/example.ts",
            `import { x } from "${specifier}";`,
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "Deleted Employee compatibility path",
        );
    });

    it("rejects a relative import of a deleted Employee compatibility path", async () => {
        const result = await checkFixture(
            "modules/routine/application/example.ts",
            'import { x } from "../../../lib/helpers/employee-helpers";',
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "Deleted Employee compatibility path",
        );
    });

    it.each([
        'export { x } from "../../../types/employees";',
        'const x = import("../../../constants/employees");',
        'const x = require("../../../lib/helpers/csv-helpers");',
        'type X = import("../../../hooks/useCSVImport").X;',
        'vi.mock("../../../components/employee/EditStatusModal");',
    ])("rejects non-static deleted Employee compatibility dependency %s", async (source) => {
        const result = await checkFixture(
            "modules/routine/application/example.ts",
            source,
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "Deleted Employee compatibility path",
        );
    });

    it("rejects Employee API routes importing the client entry", async () => {
        const result = await checkFixture(
            "app/api/employees/example.ts",
            'import { x } from "@/modules/employee/client";',
        );
        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain("server entry");
    });

    it.each([
        "app/dashboard/employees/page.tsx",
        "app/dashboard/employees/loading.tsx",
        "app/dashboard/employees/new/page.tsx",
        "app/dashboard/employees/import/page.tsx",
    ])("allows %s to compose Employee presentation through the client entry", async (routePath) => {
        const result = await checkFixture(
            routePath,
            'import { EmployeeManagementSection } from "@/modules/employee/client";',
        );

        expect(result.violations).toEqual([]);
    });

    it.each([
        "@/components/employee/EmployeeList",
        "@/components/dashboard/context/employee/EmployeeContext",
        "@/components/dashboard/sections/EmployeeManagementSection",
        "@/components/dashboard/sections/AddEmployeeSection",
    ])("rejects Employee dashboard routes importing legacy presentation %s", async (specifier) => {
        const result = await checkFixture(
            "app/dashboard/employees/page.tsx",
            `import { x } from "${specifier}";`,
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "Employee Dashboard routes must use @/modules/employee/client",
        );
    });

    it.each([
        "@/modules/employee",
        "@/modules/employee/presentation/dashboard/EmployeeList",
    ])("rejects Employee dashboard routes importing the wrong Employee entry %s", async (specifier) => {
        const result = await checkFixture(
            "app/dashboard/employees/page.tsx",
            `import { x } from "${specifier}";`,
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "Employee Dashboard routes must use @/modules/employee/client",
        );
    });

    it("rejects an Employee dashboard route that does not import the client entry", async () => {
        const result = await checkFixture(
            "app/dashboard/employees/page.tsx",
            'import { x } from "@/components/ui/button";',
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            'must consume Employee presentation through "@/modules/employee/client"',
        );
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

    it("rejects a transitive client-reachable import of the Employee server entry", async () => {
        const rootPath = await createFixture({
            ...fixtureFiles,
            "components/EmployeeClient.tsx": [
                '"use client";',
                'import { x } from "@/modules/employee";',
                "export const EmployeeClient = () => x;",
            ].join("\n"),
        });
        const result = checkArchitecture({ repositoryRoot: rootPath });

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain("Employee server entry");
    });

    it("rejects a direct client import of the Department server entry", async () => {
        const result = await checkFixture(
            "components/DepartmentClient.tsx",
            [
                '"use client";',
                'import { listDepartments } from "@/modules/department";',
                "export const DepartmentClient = () => listDepartments;",
            ].join("\n"),
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "Client-reachable runtime code must not import the Department server entry",
        );
        expect(result.violations[0]).toContain(
            "existing HTTP/API boundary",
        );
        expect(result.violations[0]).not.toContain(
            "@/modules/department/client",
        );
    });

    it("rejects a transitive client-reachable import of the Department server entry", async () => {
        const rootPath = await createFixture({
            ...fixtureFiles,
            "components/DepartmentClient.tsx": [
                '"use client";',
                'import { departmentData } from "@/lib/department-display";',
                "export const DepartmentClient = () => departmentData;",
            ].join("\n"),
            "lib/department-display.ts": [
                'import { listDepartments } from "@/modules/department";',
                "export const departmentData = listDepartments;",
            ].join("\n"),
        });
        const result = checkArchitecture({ repositoryRoot: rootPath });

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "Client-reachable runtime code must not import the Department server entry",
        );
        expect(result.violations[0]).toContain(
            "existing HTTP/API boundary",
        );
    });

    it("allows Department server consumers and browser HTTP consumption", async () => {
        const rootPath = await createFixture({
            ...fixtureFiles,
            "app/api/departments/route.ts": [
                'import { listDepartments } from "@/modules/department";',
                "export { listDepartments };",
            ].join("\n"),
            "modules/employee/application/import.ts": [
                'import { listDepartmentReferences } from "@/modules/department";',
                "export { listDepartmentReferences };",
            ].join("\n"),
            "components/DepartmentClient.tsx": [
                '"use client";',
                'import { API_ROUTES } from "@/lib/ssot/routes";',
                "export const departmentEndpoint = API_ROUTES.employees.departments;",
            ].join("\n"),
        });
        const result = checkArchitecture({ repositoryRoot: rootPath });

        expect(result.violations).toEqual([]);
    });

    it("rejects server-only runtime dependencies from the Employee client graph", async () => {
        const rootPath = await createFixture({
            ...fixtureFiles,
            "modules/employee/client.ts": 'import { x } from "@/lib/server/employee"; export { x };\n',
            "lib/server/employee.ts": "export const x = 1;\n",
        });
        const result = checkArchitecture({ repositoryRoot: rootPath });

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain("@/modules/employee/client");
    });

    it("rejects a transitive Prisma runtime dependency from the Employee client graph", async () => {
        const rootPath = await createFixture({
            ...fixtureFiles,
            "modules/employee/client.ts": 'export { x } from "./presentation/example";\n',
            "modules/employee/presentation/example.ts": [
                'import { PrismaClient } from "@prisma/client";',
                "export const x = PrismaClient;",
            ].join("\n"),
        });
        const result = checkArchitecture({ repositoryRoot: rootPath });

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain("@prisma/client");
        expect(result.violations[0]).toContain("Server-only runtime dependency");
    });

    it.each(["@/modules/employee", "@/modules/employee/client"])(
        "rejects Employee presentation internals importing their own public barrel %s",
        async (specifier) => {
            const result = await checkFixture(
                "modules/employee/presentation/dashboard/Example.tsx",
                `import { x } from "${specifier}";`,
            );

            expect(result.violations).toHaveLength(1);
            expect(result.violations[0]).toContain(
                "Employee presentation internals must use local contracts",
            );
        },
    );

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

    it.each([
        "app/api/notifications/route.ts",
        "app/api/notifications/all/route.ts",
        "app/api/notifications/[id]/read/route.ts",
        "app/api/notifications/mark-all-read/route.ts",
    ])("allows %s to use the Notification public server entry", async (routePath) => {
        const result = await checkFixture(
            routePath,
            'import { listLatestForUser } from "@/modules/notification";\n',
        );

        expect(result.violations).toEqual([]);
    });

    it("rejects a Notification API route deep-importing Notification internals", async () => {
        const result = await checkFixture(
            "app/api/notifications/route.ts",
            'import { findLatestNotifications } from "@/modules/notification/infrastructure/persistence/repository";\n',
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "Notification API routes must use the server entry @/modules/notification",
        );
    });

    it("rejects a Notification API route without the public server entry", async () => {
        const result = await checkFixture(
            "app/api/notifications/route.ts",
            'import { requireApiSession } from "@/lib/auth/api";\n',
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            'must consume Notification through "@/modules/notification"',
        );
    });

    it("rejects direct Notification Prisma access from an API route", async () => {
        const result = await checkFixture(
            "app/api/notifications/route.ts",
            [
                'import { listLatestForUser } from "@/modules/notification";',
                'import { prisma } from "@/lib/db/prisma";',
                "const notifications = await prisma.notification.findMany();",
            ].join("\n"),
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "Notification API routes must delegate Notification persistence",
        );
    });

    it.each([
        "app/dashboard/notifications/page.tsx",
        "app/dashboard/notifications/loading.tsx",
    ])("allows %s to compose Notification presentation through the client entry", async (routePath) => {
        const result = await checkFixture(
            routePath,
            'import { NotificationsSection } from "@/modules/notification/client";\n',
        );

        expect(result.violations).toEqual([]);
    });

    it.each([
        "@/modules/notification",
        "@/modules/notification/presentation/dashboard/NotificationsPageContent",
        "@/components/dashboard/notifications/NotificationsPageContent",
    ])("rejects Notification dashboard routes importing %s", async (specifier) => {
        const result = await checkFixture(
            "app/dashboard/notifications/page.tsx",
            `import { x } from "${specifier}";`,
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "Notification Dashboard routes must use @/modules/notification/client",
        );
    });

    it("rejects a Notification dashboard route that does not import the client entry", async () => {
        const result = await checkFixture(
            "app/dashboard/notifications/page.tsx",
            'import { x } from "@/components/ui/button";',
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            'must consume Notification presentation through "@/modules/notification/client"',
        );
    });

    it("allows DashboardNavbar to mount Notification through the client entry", async () => {
        const result = await checkFixture(
            "components/dashboard/layout/DashboardNavbar.tsx",
            'import { NotificationDropdown } from "@/modules/notification/client";\n',
        );

        expect(result.violations).toEqual([]);
    });

    it.each([
        "@/modules/notification",
        "@/modules/notification/presentation/dashboard/NotificationDropdown",
        "@/components/dashboard/notifications/NotificationDropdown",
    ])("rejects DashboardNavbar importing Notification through %s", async (specifier) => {
        const result = await checkFixture(
            "components/dashboard/layout/DashboardNavbar.tsx",
            `import { x } from "${specifier}";`,
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "DashboardNavbar",
        );
        expect(result.violations[0]).toContain(
            "@/modules/notification/client",
        );
    });

    it("rejects a DashboardNavbar that drops the Notification client dependency", async () => {
        const result = await checkFixture(
            "components/dashboard/layout/DashboardNavbar.tsx",
            'import { Button } from "@/components/ui/button";',
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            'must consume Notification through "@/modules/notification/client"',
        );
    });

    it("rejects Notification internals importing their own public barrel", async () => {
        const result = await checkFixture(
            "modules/notification/application/example.ts",
            'import { listLatestForUser } from "@/modules/notification";\n',
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "Notification module internals must use local contracts",
        );
    });

    it.each([
        "modules/notification/application/example.ts",
        "modules/notification/presentation/dashboard/Example.tsx",
        "modules/notification/infrastructure/persistence/repository.ts",
    ])("rejects %s importing the Notification public barrels", async (importerPath) => {
        const result = await checkFixture(
            importerPath,
            'import { x } from "@/modules/notification/client";\n',
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "Notification module internals must use local contracts",
        );
    });

    it.each([
        'import { x } from "@/components/dashboard/notifications/NotificationDropdown";',
        'export { x } from "@/components/dashboard/notifications/NotificationShared";',
        'const x = import("@/components/dashboard/notifications/NotificationsPageContent");',
        'const x = require("@/components/dashboard/notifications/NotificationPageParts");',
        'type X = import("@/components/dashboard/notifications/NotificationShared").NotificationItem;',
        'vi.mock("@/components/dashboard/notifications/NotificationDropdown");',
    ])("rejects deleted Notification presentation dependency %s", async (source) => {
        const result = await checkFixture("app/example.ts", source);

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "Deleted Notification presentation path",
        );
    });

    it("rejects a relative import of the deleted Notification presentation path", async () => {
        const result = await checkFixture(
            "modules/routine/application/example.ts",
            'import { x } from "../../../components/dashboard/notifications/NotificationDropdown";',
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "Deleted Notification presentation path",
        );
    });

    it("rejects server-only runtime dependencies from the Notification client graph", async () => {
        const rootPath = await createFixture({
            ...fixtureFiles,
            "modules/notification/client.ts": [
                '"use client";',
                'import { prisma } from "@/lib/db/prisma";',
                "export { prisma };",
            ].join("\n"),
            "lib/db/prisma.ts": "export const prisma = 1;\n",
        });
        const result = checkArchitecture({ repositoryRoot: rootPath });

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "@/modules/notification/client",
        );
        expect(result.violations[0]).toContain("Server-only runtime dependency");
    });

    it("rejects a transitive Prisma runtime dependency from the Notification client graph", async () => {
        const rootPath = await createFixture({
            ...fixtureFiles,
            "modules/notification/client.ts": 'export { x } from "./presentation/example";\n',
            "modules/notification/presentation/example.ts": [
                'import { PrismaClient } from "@prisma/client";',
                "export const x = PrismaClient;",
            ].join("\n"),
        });
        const result = checkArchitecture({ repositoryRoot: rootPath });

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain("@prisma/client");
        expect(result.violations[0]).toContain("Server-only runtime dependency");
    });

    it("does not treat type-only Prisma contracts as Notification client runtime dependencies", async () => {
        const rootPath = await createFixture({
            ...fixtureFiles,
            "modules/notification/client.ts": 'import type { Prisma } from "@prisma/client"; export type Select = Prisma.UserSelect;\n',
        });
        const result = checkArchitecture({ repositoryRoot: rootPath });

        expect(result.violations).toEqual([]);
    });

    it("rejects a transitive client-reachable import of the Notification server entry", async () => {
        const rootPath = await createFixture({
            ...fixtureFiles,
            "components/NotificationClient.tsx": [
                '"use client";',
                'import { x } from "@/modules/notification";',
                "export const NotificationClient = () => x;",
            ].join("\n"),
        });
        const result = checkArchitecture({ repositoryRoot: rootPath });

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "Client-reachable runtime code must not import the Notification server entry",
        );
    });

    it("allows Notification infrastructure to use the Prisma singleton", async () => {
        const result = await checkFixture(
            "modules/notification/infrastructure/persistence/repository.ts",
            [
                'import { prisma } from "@/lib/db/prisma";',
                "const notifications = await prisma.notification.findMany();",
            ].join("\n"),
        );

        expect(result.violations).toEqual([]);
    });

    it("rejects direct Inbox create access from Leave production code", async () => {
        const result = await checkFixture(
            "modules/leave/application/example.ts",
            "await tx.notification.create({ data: {} });",
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "direct Notification Prisma delegate access must be owned by modules/notification/infrastructure/",
        );
    });

    it("rejects direct Inbox batch access from Stock production code", async () => {
        const result = await checkFixture(
            "modules/stock/application/example.ts",
            "await client.notification.createMany({ data: [] });",
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "direct Notification Prisma delegate access must be owned by modules/notification/infrastructure/",
        );
    });

    it("allows Notification table access in test fixtures", async () => {
        const result = await checkFixture(
            "modules/stock/__tests__/notification-fixture.test.ts",
            "await prisma.notification.create({ data: {} });",
        );

        expect(result.violations).toEqual([]);
    });

    it("does not confuse NotificationOutbox persistence with Inbox persistence", async () => {
        const result = await checkFixture(
            "modules/routine/application/example.ts",
            "await tx.notificationOutbox.create({ data: {} });",
        );

        expect(result.violations).toEqual([]);
    });

    it("rejects business modules importing the legacy in-app compatibility adapter", async () => {
        const result = await checkFixture(
            "modules/routine/application/example.ts",
            'import { createInAppNotificationOnce } from "@/lib/services/notifications/in-app";\n',
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "deferred in-app compatibility adapter",
        );
    });

    it("allows business modules to consume the Notification public server entry", async () => {
        const result = await checkFixture(
            "modules/leave/application/example.ts",
            'import { createForUser } from "@/modules/notification";\n',
        );

        expect(result.violations).toEqual([]);
    });

    it("rejects business modules deep-importing Notification internals", async () => {
        const result = await checkFixture(
            "modules/leave/application/example.ts",
            'import { createNotification } from "@/modules/notification/infrastructure/persistence/repository";\n',
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            'cross-module dependencies must use the target module public entry point "@/modules/notification"',
        );
    });

    it("rejects Department API routes deep-importing Department internals", async () => {
        const result = await checkFixture(
            "app/api/departments/route.ts",
            'import { x } from "@/modules/department/application/example";\n',
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "Department API routes must use the server entry @/modules/department",
        );
    });

    it("rejects Department API routes importing the client entry", async () => {
        const result = await checkFixture(
            "app/api/departments/route.ts",
            'import { x } from "@/modules/department/client";\n',
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "Department API routes must use the server entry @/modules/department",
        );
    });

    it("rejects direct Department Prisma access outside Department infrastructure", async () => {
        const result = await checkFixture(
            "app/api/departments/route.ts",
            [
                'import { prisma } from "@/lib/db/prisma";',
                "const departments = await prisma.department.findMany();",
            ].join("\n"),
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "direct Department Prisma access must be owned by modules/department/infrastructure/",
        );
    });

    it("allows Department infrastructure to own direct Department Prisma access", async () => {
        const result = await checkFixture(
            "modules/department/infrastructure/persistence/repository.ts",
            [
                'import { prisma } from "@/lib/db/prisma";',
                "const departments = await prisma.department.findMany();",
            ].join("\n"),
        );

        expect(result.violations).toEqual([]);
    });

    it("rejects Department depending on Employee", async () => {
        const result = await checkFixture(
            "modules/department/application/example.ts",
            'import { x } from "@/modules/employee";\n',
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "Department module must not depend on Employee",
        );
    });

    it("rejects Department internals importing their own public barrel", async () => {
        const result = await checkFixture(
            "modules/department/application/example.ts",
            'import { x } from "@/modules/department";\n',
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "Department module internals must use local contracts",
        );
    });

    it("allows Employee to consume the Department public server API", async () => {
        const result = await checkFixture(
            "modules/employee/application/example.ts",
            'import { x } from "@/modules/department";\n',
        );

        expect(result.violations).toEqual([]);
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

    it("allows Audit infrastructure to own direct AuditLog persistence", async () => {
        const result = await checkFixture(
            "modules/audit/infrastructure/persistence/repository.ts",
            [
                "await prisma.auditLog.create({ data: {} });",
                "await tx.auditLog.findMany();",
            ].join("\n"),
        );

        expect(result.violations).toEqual([]);
    });

    it("rejects direct AuditLog persistence from a new production file", async () => {
        const result = await checkFixture(
            "app/api/new-audit-producer.ts",
            "await prisma.auditLog.create({ data: {} });",
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "direct AuditLog Prisma delegate access must be owned by modules/audit/infrastructure/",
        );
    });

    it("rejects direct AuditLog persistence from a migrated producer", async () => {
        const result = await checkFixture(
            "modules/employee/application/mutations.ts",
            "await tx.auditLog.create({ data: {} });",
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "direct AuditLog Prisma delegate access must be owned by modules/audit/infrastructure/",
        );
    });

    it("rejects an aliased AuditLog delegate in a migrated producer", async () => {
        const result = await checkFixture(
            "modules/employee/application/mutations.ts",
            [
                "const auditLog = tx.auditLog;",
                "await auditLog.create({ data: {} });",
            ].join("\n"),
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "direct AuditLog Prisma delegate access must be owned by modules/audit/infrastructure/",
        );
    });

    it("rejects every direct AuditLog delegate operation in a migrated producer", async () => {
        const result = await checkFixture(
            "modules/employee/application/mutations.ts",
            [
                "await tx.auditLog.create({ data: {} });",
                "await tx.auditLog.create({ data: {} });",
            ].join("\n"),
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "direct AuditLog Prisma delegate access must be owned by modules/audit/infrastructure/",
        );
    });

    it.each([
        "modules/employee/application/example.ts",
        "modules/leave/application/example.ts",
        "modules/stock/application/example.ts",
        "modules/routine/application/example.ts",
    ])("rejects %s importing the legacy Audit server adapter", async (importerPath) => {
        const result = await checkFixture(
            importerPath,
            'import { x } from "@/lib/server/audit";\n',
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "feature-owned Audit producer",
        );
    });

    it.each([
        "modules/employee/application/example.ts",
        "modules/leave/application/example.ts",
        "modules/stock/application/example.ts",
        "modules/routine/application/example.ts",
    ])("requires %s to use the Audit public server entry", async (importerPath) => {
        const result = await checkFixture(
            importerPath,
            'import { appendAuditInTransaction } from "@/modules/audit/application/commands";\n',
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            'cross-module dependencies must use the target module public entry point "@/modules/audit"',
        );
    });

    it("rejects the deleted global Audit feature-contract path", async () => {
        const result = await checkFixture(
            "app/example.ts",
            'import type { x } from "@/lib/audit-log/contracts";\n',
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "Deleted Audit feature contracts",
        );
    });

    it("rejects Audit API routes that deep-import Audit internals", async () => {
        const result = await checkFixture(
            "app/api/audit-logs/route.ts",
            'import { getAuditLogs } from "@/modules/audit/application/queries";\n',
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "Audit API routes must use the server entry @/modules/audit",
        );
    });

    it.each([
        "app/dashboard/audit/page.tsx",
        "app/dashboard/audit/loading.tsx",
    ])("allows %s to compose Audit presentation through the client entry", async (routePath) => {
        const result = await checkFixture(
            routePath,
            'import { AuditLogsSection } from "@/modules/audit/client";\n',
        );

        expect(result.violations).toEqual([]);
    });

    it.each([
        "@/modules/audit",
        "@/modules/audit/presentation/dashboard/AuditLogsSection",
        "@/components/audit/AuditLogViewer",
        "@/components/dashboard/context/audit-logs/AuditLogsProvider",
    ])("rejects Audit dashboard routes importing %s", async (specifier) => {
        const result = await checkFixture(
            "app/dashboard/audit/page.tsx",
            `import { x } from "${specifier}";`,
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "Audit Dashboard routes must use @/modules/audit/client",
        );
    });

    it("rejects an Audit dashboard route that does not import the client entry", async () => {
        const result = await checkFixture(
            "app/dashboard/audit/page.tsx",
            'import { x } from "@/components/ui/button";',
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            'must consume Audit presentation through "@/modules/audit/client"',
        );
    });

    it.each([
        "@/components/audit/AuditLogViewer",
        "@/components/dashboard/context/audit-logs/AuditLogsProvider",
        "@/components/dashboard/sections/AuditLogsSection",
        "@/lib/audit-log/display",
        "@/constants/audit",
    ])("rejects deleted Audit presentation dependency %s", async (specifier) => {
        const result = await checkFixture(
            "app/example.ts",
            `import { x } from "${specifier}";`,
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "Deleted Audit presentation path",
        );
    });

    it("rejects a relative import of a deleted Audit presentation path", async () => {
        const result = await checkFixture(
            "app/dashboard/audit/example.tsx",
            'import { x } from "../../../components/audit/AuditLogViewer";',
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "Deleted Audit presentation path",
        );
    });

    it.each(["@/modules/audit", "@/modules/audit/client"])(
        "rejects Audit presentation internals importing their own public barrel %s",
        async (specifier) => {
            const result = await checkFixture(
                "modules/audit/presentation/dashboard/Example.tsx",
                `import { x } from "${specifier}";`,
            );

            expect(result.violations).toHaveLength(1);
            expect(result.violations[0]).toContain(
                "Audit module internals must use local contracts",
            );
        },
    );

    it("rejects server-only runtime dependencies from the Audit client graph", async () => {
        const rootPath = await createFixture({
            ...fixtureFiles,
            "modules/audit/client.ts": '"use client"; export { x } from "./presentation/example";\n',
            "modules/audit/presentation/example.ts": [
                'import { x } from "@/lib/server/audit";',
                "export { x };",
            ].join("\n"),
            "lib/server/audit.ts": "export const x = 1;\n",
        });
        const result = checkArchitecture({ repositoryRoot: rootPath });

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "Server-only runtime dependency is reachable from @/modules/audit/client",
        );
    });

    it("rejects a transitive Prisma runtime dependency from the Audit client graph", async () => {
        const rootPath = await createFixture({
            ...fixtureFiles,
            "modules/audit/client.ts": '"use client"; export { x } from "./presentation/example";\n',
            "modules/audit/presentation/example.ts": [
                'import { PrismaClient } from "@prisma/client";',
                "export const x = PrismaClient;",
            ].join("\n"),
        });
        const result = checkArchitecture({ repositoryRoot: rootPath });

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain("@prisma/client");
        expect(result.violations[0]).toContain(
            "Server-only runtime dependency is reachable from @/modules/audit/client",
        );
    });

    it("does not treat type-only Prisma contracts as Audit client runtime dependencies", async () => {
        const rootPath = await createFixture({
            ...fixtureFiles,
            "modules/audit/client.ts": [
                '"use client";',
                'import type { Prisma } from "@prisma/client";',
                "export type Select = Prisma.UserSelect;",
            ].join("\n"),
        });
        const result = checkArchitecture({ repositoryRoot: rootPath });

        expect(result.violations).toEqual([]);
    });

    it("rejects a transitive Audit application dependency from the Audit client graph", async () => {
        const rootPath = await createFixture({
            ...fixtureFiles,
            "modules/audit/client.ts": '"use client"; export { x } from "./presentation/example";\n',
            "modules/audit/presentation/example.ts": [
                'import { x } from "@/modules/audit/application/example";',
                "export { x };",
            ].join("\n"),
        });
        const result = checkArchitecture({ repositoryRoot: rootPath });

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "Server-only runtime dependency is reachable from @/modules/audit/client",
        );
    });

    it("rejects a transitive Stock server entry from the Audit client graph", async () => {
        const rootPath = await createFixture({
            ...fixtureFiles,
            "modules/audit/client.ts": '"use client"; export { x } from "./presentation/example";\n',
            "modules/audit/presentation/example.ts": [
                'import { x } from "@/modules/stock";',
                "export { x };",
            ].join("\n"),
        });
        const result = checkArchitecture({ repositoryRoot: rootPath });

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "Audit client graph must not reach the stock server entry",
        );
    });

    it("allows the Audit client graph to consume the Employee client entry", async () => {
        const rootPath = await createFixture({
            ...fixtureFiles,
            "modules/audit/client.ts": '"use client"; export { x } from "./presentation/example";\n',
            "modules/audit/presentation/example.ts": [
                'import { x } from "@/modules/employee/client";',
                "export { x };",
            ].join("\n"),
        });
        const result = checkArchitecture({ repositoryRoot: rootPath });

        expect(result.violations).toEqual([]);
    });

    it("allows legitimate AuditLog access in test fixtures", async () => {
        const result = await checkFixture(
            "modules/stock/__tests__/integration/stock-fixtures.ts",
            "await client.auditLog.deleteMany();",
        );

        expect(result.violations).toEqual([]);
    });

    it.each([
        ["direct Prisma access", "await prisma.authRefreshToken.findUnique();"],
        ["transaction delegate access", "await tx.authRefreshToken.updateMany();"],
        ["PasswordResetToken access", "await prisma.passwordResetToken.findUnique();"],
        [
            "aliased delegate access",
            [
                "const tokens = prisma.authRefreshToken;",
                "await tokens.findMany();",
            ].join("\n"),
        ],
        [
            "destructured delegate access",
            [
                "const { authRefreshToken } = prisma;",
                "await authRefreshToken.findMany();",
            ].join("\n"),
        ],
    ])("rejects production Auth persistence %s", async (_label, source) => {
        const result = await checkFixture("app/api/example.ts", source);

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "direct AuthRefreshToken/PasswordResetToken Prisma delegate access must be owned by modules/auth/infrastructure/persistence/",
        );
    });

    it("allows Auth persistence infrastructure to use both owned delegates", async () => {
        const rootPath = await createFixture({
            ...fixtureFiles,
            "modules/auth/infrastructure/persistence/repository.ts": [
                "await prisma.authRefreshToken.findUnique();",
                "await tx.passwordResetToken.updateMany();",
            ].join("\n"),
        });
        const result = checkArchitecture({ repositoryRoot: rootPath });

        expect(result.violations).toEqual([]);
    });

    it.each([
        "__tests__/auth/persistence.test.ts",
        "prisma/seed.ts",
        "prisma/migrations/20260907/auth-fixture.ts",
        "test-support/auth-fixtures.ts",
    ])("allows intentional Auth persistence support source %s", async (filePath) => {
        const result = await checkFixture(
            filePath,
            "await prisma.passwordResetToken.deleteMany();",
        );

        expect(result.violations).toEqual([]);
    });

    it("allows normal server consumers to use the Auth public entry", async () => {
        const result = await checkFixture(
            "app/api/auth/example.ts",
            'import { resolveAuthenticatedUserId } from "@/modules/auth";\n',
        );

        expect(result.violations).toEqual([]);
    });

    it("rejects external consumers deep-importing Auth internals", async () => {
        const result = await checkFixture(
            "app/api/example.ts",
            'import { resolveAuthenticatedPrincipal } from "@/modules/auth/application/sessions";\n',
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            'external consumers must use the target module public API "@/modules/auth"',
        );
    });

    it("rejects Auth internals importing their own public barrel", async () => {
        const result = await checkFixture(
            "modules/auth/application/example.ts",
            'import { resolveAuthenticatedUserId } from "@/modules/auth";\n',
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "Auth module internals must use local contracts instead of their own public barrel",
        );
    });

    it("rejects Client Component runtime reachability to the Auth server entry", async () => {
        const result = await checkFixture(
            "app/dashboard/auth-client.tsx",
            [
                '"use client";',
                'import { resolveAuthenticatedUserId } from "@/modules/auth";',
                "export { resolveAuthenticatedUserId };",
            ].join("\n"),
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "Client-reachable runtime code must not import the Auth server entry",
        );
    });

    it("allows production consumers to use the Auth browser entry", async () => {
        const result = await checkFixture(
            "app/login/page.tsx",
            'import { LoginForm } from "@/modules/auth/client";\n',
        );

        expect(result.violations).toEqual([]);
    });

    it.each([
        "@/components/auth",
        "@/components/auth/HybridAuthProvider",
        "@/lib/auth/client",
    ])("rejects deleted Auth browser path %s", async (specifier) => {
        const result = await checkFixture(
            "app/login/page.tsx",
            `import { x } from "${specifier}";`,
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain("Deleted Auth browser path");
    });

    it("rejects external consumers deep-importing Auth presentation", async () => {
        const result = await checkFixture(
            "app/login/page.tsx",
            'import { x } from "@/modules/auth/presentation/example";\n',
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            "Auth presentation consumers must use @/modules/auth/client",
        );
    });

    it("keeps external Auth server deep imports on the server entry", async () => {
        const result = await checkFixture(
            "app/api/example.ts",
            'import { x } from "@/modules/auth/infrastructure/persistence/account-repository";\n',
        );

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain(
            'external consumers must use the target module public API "@/modules/auth"',
        );
    });

    it("rejects a transitive Prisma runtime dependency from the Auth client graph", async () => {
        const rootPath = await createFixture({
            ...fixtureFiles,
            "modules/auth/client.ts": '"use client"; export { x } from "./presentation/example";\n',
            "modules/auth/presentation/example.ts": [
                'import { PrismaClient } from "@prisma/client";',
                "export const x = PrismaClient;",
            ].join("\n"),
        });
        const result = checkArchitecture({ repositoryRoot: rootPath });

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain("@prisma/client");
        expect(result.violations[0]).toContain(
            "Server-only runtime dependency is reachable from @/modules/auth/client",
        );
    });

    it("rejects a transitive bcryptjs runtime dependency from the Auth client graph", async () => {
        const rootPath = await createFixture({
            ...fixtureFiles,
            "modules/auth/client.ts": '"use client"; export { x } from "./presentation/example";\n',
            "modules/auth/presentation/example.ts": [
                'import bcrypt from "bcryptjs";',
                "export const x = bcrypt;",
            ].join("\n"),
        });
        const result = checkArchitecture({ repositoryRoot: rootPath });

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain("bcryptjs");
        expect(result.violations[0]).toContain(
            "Server-only runtime dependency is reachable from @/modules/auth/client",
        );
    });

    it("rejects a transitive next/headers dependency from the Auth client graph", async () => {
        const rootPath = await createFixture({
            ...fixtureFiles,
            "modules/auth/client.ts": '"use client"; export { x } from "./presentation/example";\n',
            "modules/auth/presentation/example.ts": [
                'import { headers } from "next/headers";',
                "export const x = headers;",
            ].join("\n"),
        });
        const result = checkArchitecture({ repositoryRoot: rootPath });

        expect(result.violations).toHaveLength(1);
        expect(result.violations[0]).toContain("next/headers");
        expect(result.violations[0]).toContain(
            "Server-only runtime dependency is reachable from @/modules/auth/client",
        );
    });

    it("rejects a transitive Auth server index from the Auth client graph", async () => {
        const rootPath = await createFixture({
            ...fixtureFiles,
            "modules/auth/client.ts": '"use client"; export { x } from "./presentation/example";\n',
            "modules/auth/presentation/example.ts": [
                'import { x } from "@/modules/auth";',
                "export { x };",
            ].join("\n"),
        });
        const result = checkArchitecture({ repositoryRoot: rootPath });

        expect(result.violations.some((message) =>
            message.includes("Auth browser graph must not reach the @/modules/auth server entry"),
        )).toBe(true);
    });

    it("allows a browser-safe Auth client graph", async () => {
        const rootPath = await createFixture({
            ...fixtureFiles,
            "modules/auth/client.ts": '"use client"; export { x } from "./presentation/example";\n',
            "modules/auth/presentation/example.ts": [
                'import { x } from "@/components/ui/button";',
                "export { x };",
            ].join("\n"),
            "components/ui/button.tsx": 'export const x = 1;\n',
        });
        const result = checkArchitecture({ repositoryRoot: rootPath });

        expect(result.violations).toEqual([]);
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
