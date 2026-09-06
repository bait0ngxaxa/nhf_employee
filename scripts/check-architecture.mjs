import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { isBuiltin } from "node:module";
import ts from "typescript";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceExtensions = new Set([
    ".cjs",
    ".cts",
    ".js",
    ".jsx",
    ".mjs",
    ".mts",
    ".ts",
    ".tsx",
]);
const ignoredDirectoryNames = new Set([
    ".git",
    ".next",
    ".turbo",
    ".vercel",
    "build",
    "coverage",
    "dist",
    "generated",
    "graphify-out",
    "node_modules",
    "out",
    "storybook-static",
]);

function pathIsWithin(candidatePath, parentPath) {
    const relativePath = relative(parentPath, candidatePath);
    return (
        relativePath === ""
        || (
            relativePath !== ".."
            && !relativePath.startsWith(`..${sep}`)
            && !isAbsolute(relativePath)
        )
    );
}

function getPathSegments(candidatePath, parentPath) {
    if (!pathIsWithin(candidatePath, parentPath)) {
        return null;
    }

    const relativePath = relative(parentPath, candidatePath);
    return relativePath === ""
        ? []
        : relativePath.split(/[\\/]+/).filter(Boolean);
}

function getSourceFiles(directoryPath) {
    if (!existsSync(directoryPath)) {
        return [];
    }

    const entries = readdirSync(directoryPath, { withFileTypes: true });
    return entries.flatMap((entry) => {
        const entryPath = resolve(directoryPath, entry.name);
        if (entry.isDirectory()) {
            if (ignoredDirectoryNames.has(entry.name.toLowerCase())) {
                return [];
            }

            return getSourceFiles(entryPath);
        }

        return sourceExtensions.has(extname(entry.name)) ? [entryPath] : [];
    });
}

function getImportSourcePath(specifier, importerPath, rootPath) {
    if (specifier === "@/modules" || specifier.startsWith("@/modules/")) {
        return resolve(rootPath, specifier.slice(2));
    }

    if (specifier === "@/shared" || specifier.startsWith("@/shared/")) {
        return resolve(rootPath, specifier.slice(2));
    }

    if (specifier === "modules" || specifier.startsWith("modules/")) {
        return resolve(rootPath, specifier);
    }

    if (specifier === "shared" || specifier.startsWith("shared/")) {
        return resolve(rootPath, specifier);
    }

    if (specifier.startsWith(".")) {
        return resolve(dirname(importerPath), specifier);
    }

    return null;
}

function getOwner(filePath, modulesRoot, sharedRoot) {
    const moduleSegments = getPathSegments(filePath, modulesRoot);
    if (moduleSegments !== null && moduleSegments.length > 0) {
        return {
            kind: "module",
            name: moduleSegments[0],
        };
    }

    if (getPathSegments(filePath, sharedRoot) !== null) {
        return { kind: "shared", name: null };
    }

    return { kind: "external", name: null };
}

function getArchitectureTarget(specifier, importerPath, rootPath, modulesRoot, sharedRoot) {
    const importPath = getImportSourcePath(specifier, importerPath, rootPath);
    if (importPath === null) {
        return null;
    }

    const moduleSegments = getPathSegments(importPath, modulesRoot);
    if (moduleSegments !== null && moduleSegments.length > 0) {
        return {
            kind: "modules",
            moduleName: moduleSegments[0],
            isPublicEntryPoint: moduleSegments.length === 1
                || (moduleSegments.length === 2 && moduleSegments[1] === "client"),
        };
    }

    if (getPathSegments(importPath, sharedRoot) !== null) {
        return {
            kind: "shared",
            moduleName: null,
            isPublicEntryPoint: false,
        };
    }

    return null;
}

function getModuleDependencyViolation(owner, moduleSpecifier) {
    if (
        owner.kind === "module"
        && moduleSpecifier === "@/lib/services/outbox/processor"
    ) {
        return "Business modules must not depend on the global Outbox Processor; schedule it from the delivery/composition layer.";
    }

    return null;
}

const leaveApiRouteDirectories = [
    "app/api/leave",
    "app/api/line/leave",
];

const leavePresentationRouteDirectories = [
    "app/dashboard/leave",
    "app/liff/leave",
];

const employeeApiRouteDirectory = "app/api/employees";
const employeeDashboardRouteDirectory = "app/dashboard/employees";
const departmentApiRouteDirectory = "app/api/departments";
const employeeDashboardFeatureRouteFiles = [
    "app/dashboard/employees/page.tsx",
    "app/dashboard/employees/loading.tsx",
    "app/dashboard/employees/new/page.tsx",
    "app/dashboard/employees/import/page.tsx",
];
const legacyEmployeeServerPrefixes = [
    "@/lib/services/employee",
    "@/lib/validations/employee",
];
const legacyEmployeePresentationPrefixes = [
    "@/components/employee",
    "@/components/dashboard/context/employee",
    "@/components/dashboard/sections/EmployeeManagementSection",
    "@/components/dashboard/sections/AddEmployeeSection",
];
const deletedEmployeeCompatibilityPrefixes = [
    "@/types/employees",
    "@/constants/employees",
    "@/lib/helpers/employee-helpers",
    "@/lib/helpers/csv-helpers",
    "@/hooks/useCSVImport",
    "@/components/employee/EditStatusModal",
];

const legacyLeavePresentationPrefixes = [
    "@/components/dashboard/leave",
    "@/components/dashboard/sections/LeaveManagementSection",
    "@/components/liff/leave",
    "@/hooks/leave",
    "@/hooks/useLeaveApprovals",
    "@/hooks/useLeaveProfile",
    "@/lib/client/liff-leave",
];

const legacyLeaveImportPrefixes = [
    "@/constants/leave",
    "@/lib/email/templates/leave-action",
    "@/lib/email/templates/leave-event",
    "@/lib/email/templates/leave-result",
    "@/lib/line/flex-messages/leave",
    "@/lib/line/leave-links",
    "@/lib/server/leave-api",
    "@/lib/server/leave-not-taken-api",
    "@/lib/server/leave-request-api",
    "@/lib/services/leave",
    "@/lib/ssot/leave-attachments",
    "@/lib/types/leave",
    "@/lib/uploads/leave",
    "@/lib/validations/leave-attachments",
    "@/lib/validations/leave-report",
    "@/lib/validations/leave",
];

function hasImportPrefix(moduleSpecifier, prefix) {
    return moduleSpecifier === prefix || moduleSpecifier.startsWith(`${prefix}/`);
}

function getLeaveRouteDependencyViolation(filePath, rootPath, moduleSpecifier) {
    const resolvedImport = moduleSpecifier.startsWith("@/")
        ? resolve(rootPath, moduleSpecifier.slice(2))
        : getImportSourcePath(moduleSpecifier, filePath, rootPath);
    const normalizedSpecifier = resolvedImport === null
        ? moduleSpecifier
        : `@/${relativeFilePath(resolvedImport, rootPath).replace(/\.[cm]?[jt]sx?$/, "")}`;
    const isPresentationRoute = leavePresentationRouteDirectories.some((directory) =>
        pathIsWithin(filePath, resolve(rootPath, directory)),
    );
    const isLeavePresentation = pathIsWithin(
        filePath, resolve(rootPath, "modules/leave/presentation"),
    );
    const leaveModuleRoot = resolve(rootPath, "modules/leave");
    const isLeaveModuleInternal = pathIsWithin(filePath, leaveModuleRoot)
        && ![
            resolve(leaveModuleRoot, "index.ts"),
            resolve(leaveModuleRoot, "client.ts"),
        ].includes(filePath);
    if (isPresentationRoute || isLeavePresentation) {
        if ([...legacyLeaveImportPrefixes, ...legacyLeavePresentationPrefixes].some((prefix) =>
            hasImportPrefix(normalizedSpecifier, prefix),
        )) {
            return "Leave presentation must not depend on legacy Leave ownership paths; routes use @/modules/leave/client and module internals use local contracts.";
        }
        if (isPresentationRoute && hasImportPrefix(normalizedSpecifier, "@/modules/leave")
            && normalizedSpecifier !== "@/modules/leave/client") {
            return "Leave presentation routes must use @/modules/leave/client.";
        }
    }
    if (isLeaveModuleInternal && ["@/modules/leave", "@/modules/leave/client"].includes(normalizedSpecifier)) {
        return "Leave module internals must use local contracts instead of their own public barrel.";
    }
    const isLeaveApiRoute = leaveApiRouteDirectories.some((directory) =>
        pathIsWithin(filePath, resolve(rootPath, directory)),
    );
    if (!isLeaveApiRoute) {
        return null;
    }

    if (legacyLeaveImportPrefixes.some((prefix) =>
        hasImportPrefix(normalizedSpecifier, prefix),
    )) {
        return "Leave API routes must use the Leave module public API \"@/modules/leave\" instead of legacy Leave ownership paths.";
    }
    if (hasImportPrefix(normalizedSpecifier, "@/modules/leave")
        && normalizedSpecifier !== "@/modules/leave") {
        return "Leave API routes must use the server entry @/modules/leave.";
    }

    return null;
}

function getEmployeeDependencyViolation(filePath, rootPath, moduleSpecifier) {
    const resolvedImport = moduleSpecifier.startsWith("@/")
        ? resolve(rootPath, moduleSpecifier.slice(2))
        : getImportSourcePath(moduleSpecifier, filePath, rootPath);
    const normalizedSpecifier = resolvedImport === null
        ? moduleSpecifier
        : `@/${relativeFilePath(resolvedImport, rootPath).replace(/\.[cm]?[jt]sx?$/, "")}`;
    const employeeModuleRoot = resolve(rootPath, "modules/employee");
    const isEmployeeModule = pathIsWithin(filePath, employeeModuleRoot);
    const isEmployeeInternal = pathIsWithin(filePath, employeeModuleRoot)
        && ![
            resolve(employeeModuleRoot, "index.ts"),
            resolve(employeeModuleRoot, "client.ts"),
        ].includes(filePath);
    const isEmployeePresentation = pathIsWithin(
        filePath,
        resolve(employeeModuleRoot, "presentation"),
    );
    if (isEmployeeModule && hasImportPrefix(normalizedSpecifier, "@/modules/leave")) {
        return "Employee module must not depend on Leave; inject the Employee offboarding-responsibility port at the composition boundary.";
    }
    if (isEmployeePresentation
        && ["@/modules/employee", "@/modules/employee/client"].includes(normalizedSpecifier)) {
        return "Employee presentation internals must use local contracts instead of their own public barrel.";
    }
    if (isEmployeeInternal
        && ["@/modules/employee", "@/modules/employee/client"].includes(normalizedSpecifier)) {
        return "Employee module internals must use local contracts instead of their own public barrel.";
    }

    if (!pathIsWithin(filePath, resolve(rootPath, employeeApiRouteDirectory))) return null;
    if (legacyEmployeeServerPrefixes.some((prefix) => hasImportPrefix(normalizedSpecifier, prefix))) {
        return "Employee API routes must use the Employee module public API \"@/modules/employee\".";
    }
    if (hasImportPrefix(normalizedSpecifier, "@/modules/employee")
        && normalizedSpecifier !== "@/modules/employee") {
        return "Employee API routes must use the server entry @/modules/employee.";
    }
    return null;
}

function getDepartmentRouteDependencyViolation(filePath, rootPath, moduleSpecifier) {
    if (!pathIsWithin(filePath, resolve(rootPath, departmentApiRouteDirectory))) {
        return null;
    }

    const resolvedImport = moduleSpecifier.startsWith("@/")
        ? resolve(rootPath, moduleSpecifier.slice(2))
        : getImportSourcePath(moduleSpecifier, filePath, rootPath);
    const normalizedSpecifier = resolvedImport === null
        ? moduleSpecifier
        : `@/${relativeFilePath(resolvedImport, rootPath).replace(/\.[cm]?[jt]sx?$/, "")}`;

    if (hasImportPrefix(normalizedSpecifier, "@/modules/department")
        && normalizedSpecifier !== "@/modules/department") {
        return "Department API routes must use the server entry @/modules/department.";
    }

    return null;
}

function getDepartmentDependencyViolation(filePath, rootPath, moduleSpecifier) {
    const departmentModuleRoot = resolve(rootPath, "modules/department");
    if (!pathIsWithin(filePath, departmentModuleRoot)) return null;

    const resolvedImport = moduleSpecifier.startsWith("@/")
        ? resolve(rootPath, moduleSpecifier.slice(2))
        : getImportSourcePath(moduleSpecifier, filePath, rootPath);
    const normalizedSpecifier = resolvedImport === null
        ? moduleSpecifier
        : `@/${relativeFilePath(resolvedImport, rootPath).replace(/\.[cm]?[jt]sx?$/, "")}`;

    const isDepartmentInternal = ![
        resolve(departmentModuleRoot, "index.ts"),
    ].includes(filePath);
    if (isDepartmentInternal
        && ["@/modules/department", "@/modules/department/client"].includes(normalizedSpecifier)) {
        return "Department module internals must use local contracts instead of their own public barrel.";
    }

    if (hasImportPrefix(normalizedSpecifier, "@/modules/employee")) {
        return "Department module must not depend on Employee; keep the Department capability independent.";
    }

    return null;
}

function getDeletedEmployeeCompatibilityViolation(filePath, rootPath, moduleSpecifier) {
    const resolvedImport = moduleSpecifier.startsWith("@/")
        ? resolve(rootPath, moduleSpecifier.slice(2))
        : getImportSourcePath(moduleSpecifier, filePath, rootPath);
    const normalizedSpecifier = resolvedImport === null
        ? moduleSpecifier
        : `@/${relativeFilePath(resolvedImport, rootPath).replace(/\.[cm]?[jt]sx?$/, "")}`;
    const deletedPath = deletedEmployeeCompatibilityPrefixes.find((prefix) =>
        hasImportPrefix(normalizedSpecifier, prefix),
    );

    return deletedPath === undefined
        ? null
        : `Deleted Employee compatibility path "${deletedPath}" must not be imported.`;
}

function getEmployeeDashboardRouteDependencyViolation(filePath, rootPath, moduleSpecifier) {
    if (!pathIsWithin(filePath, resolve(rootPath, employeeDashboardRouteDirectory))) {
        return null;
    }

    const resolvedImport = moduleSpecifier.startsWith("@/")
        ? resolve(rootPath, moduleSpecifier.slice(2))
        : getImportSourcePath(moduleSpecifier, filePath, rootPath);
    const normalizedSpecifier = resolvedImport === null
        ? moduleSpecifier
        : `@/${relativeFilePath(resolvedImport, rootPath).replace(/\.[cm]?[jt]sx?$/, "")}`;

    if (legacyEmployeePresentationPrefixes.some((prefix) =>
        hasImportPrefix(normalizedSpecifier, prefix),
    )) {
        return "Employee Dashboard routes must use @/modules/employee/client instead of legacy Employee presentation paths.";
    }

    if (hasImportPrefix(normalizedSpecifier, "@/modules/employee/presentation")) {
        return "Employee Dashboard routes must use @/modules/employee/client instead of deep Employee presentation imports.";
    }

    const isFeatureRoute = employeeDashboardFeatureRouteFiles.some((routePath) =>
        pathIsWithin(filePath, resolve(rootPath, routePath)),
    );
    if (isFeatureRoute
        && hasImportPrefix(normalizedSpecifier, "@/modules/employee")
        && normalizedSpecifier !== "@/modules/employee/client") {
        return "Employee Dashboard routes must use @/modules/employee/client.";
    }

    return null;
}

function getEmployeeDashboardRouteCompositionViolations(rootPath, sourceFiles) {
    const clientEntry = "@/modules/employee/client";
    const violations = [];

    for (const routePath of employeeDashboardFeatureRouteFiles) {
        const filePath = resolve(rootPath, routePath);
        if (!sourceFiles.includes(filePath)) continue;

        const imports = getImports(filePath);
        const normalizedSpecifiers = imports.map((record) => {
            const resolvedImport = record.moduleSpecifier.startsWith("@/")
                ? resolve(rootPath, record.moduleSpecifier.slice(2))
                : getImportSourcePath(record.moduleSpecifier, filePath, rootPath);
            return resolvedImport === null
                ? record.moduleSpecifier
                : `@/${relativeFilePath(resolvedImport, rootPath).replace(/\.[cm]?[jt]sx?$/, "")}`;
        });

        if (normalizedSpecifiers.includes(clientEntry)) continue;

        const hasEmployeePresentationImport = normalizedSpecifiers.some((specifier) =>
            hasImportPrefix(specifier, "@/modules/employee")
            || legacyEmployeePresentationPrefixes.some((prefix) =>
                hasImportPrefix(specifier, prefix),
            ),
        );
        if (hasEmployeePresentationImport) continue;

        violations.push(
            `${relativeFilePath(filePath, rootPath)} must consume Employee presentation through "${clientEntry}".`,
        );
    }

    return violations;
}

function getScriptKind(filePath) {
    switch (extname(filePath)) {
        case ".js":
        case ".mjs":
        case ".cjs":
            return ts.ScriptKind.JS;
        case ".jsx":
            return ts.ScriptKind.JSX;
        case ".tsx":
            return ts.ScriptKind.TSX;
        default:
            return ts.ScriptKind.TS;
    }
}

function getStringLiteralText(node) {
    return ts.isStringLiteralLike(node) ? node.text : null;
}

function getImports(filePath, runtimeOnly = false) {
    const contents = readFileSync(filePath, "utf8");
    const sourceFile = ts.createSourceFile(
        filePath,
        runtimeOnly ? ts.transpileModule(contents, {
            fileName: filePath,
            compilerOptions: {
                module: ts.ModuleKind.ESNext,
                target: ts.ScriptTarget.ESNext,
                jsx: ts.JsxEmit.Preserve,
            },
        }).outputText : contents,
        ts.ScriptTarget.Latest,
        true,
        getScriptKind(filePath),
    );
    const imports = [];

    function addImport(node, moduleSpecifier) {
        if (moduleSpecifier !== null) {
            imports.push({
                line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
                moduleSpecifier,
            });
        }
    }

    function visit(node) {
        if (ts.isImportDeclaration(node)) {
            addImport(node, getStringLiteralText(node.moduleSpecifier));
        } else if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined) {
            addImport(node, getStringLiteralText(node.moduleSpecifier));
        } else if (
            ts.isImportEqualsDeclaration(node)
            && ts.isExternalModuleReference(node.moduleReference)
        ) {
            addImport(node, getStringLiteralText(node.moduleReference.expression));
        } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
            addImport(node, getStringLiteralText(node.argument.literal));
        } else if (ts.isCallExpression(node) && node.arguments.length > 0) {
            const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
            const isRequireCall = (
                ts.isIdentifier(node.expression)
                && node.expression.text === "require"
            );
            const isTestModuleMock = (
                ts.isPropertyAccessExpression(node.expression)
                && ts.isIdentifier(node.expression.expression)
                && ["vi", "jest"].includes(node.expression.expression.text)
                && ["mock", "doMock"].includes(node.expression.name.text)
            );
            if (isDynamicImport || isRequireCall || isTestModuleMock) {
                addImport(node, getStringLiteralText(node.arguments[0]));
            }
        }

        ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return imports;
}

function resolveSourcePath(importTarget) {
    if (importTarget === null) return null;

    return [
        ...[...sourceExtensions].map((extension) => `${importTarget}${extension}`),
        ...[...sourceExtensions].map((extension) => resolve(importTarget, `index${extension}`)),
        ...(sourceExtensions.has(extname(importTarget)) ? [importTarget] : []),
    ].find((candidate) => existsSync(candidate)) ?? null;
}

function getRuntimeImportTarget(specifier, importerPath, rootPath) {
    const importTarget = specifier.startsWith("@/")
        ? resolve(rootPath, specifier.slice(2))
        : getImportSourcePath(specifier, importerPath, rootPath);

    return {
        importTarget,
        sourcePath: resolveSourcePath(importTarget),
    };
}

function hasUseClientDirective(filePath) {
    const contents = readFileSync(filePath, "utf8");
    const sourceFile = ts.createSourceFile(
        filePath,
        contents,
        ts.ScriptTarget.Latest,
        true,
        getScriptKind(filePath),
    );

    for (const statement of sourceFile.statements) {
        if (!ts.isExpressionStatement(statement)
            || !ts.isStringLiteralLike(statement.expression)) {
            return false;
        }
        if (statement.expression.text === "use client") return true;
    }

    return false;
}

function isTestSource(filePath, rootPath) {
    const repositoryPath = relativeFilePath(filePath, rootPath);
    return repositoryPath.split("/").includes("__tests__")
        || /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(repositoryPath);
}

function getDepartmentPersistenceViolation(filePath, rootPath) {
    const departmentInfrastructureRoot = resolve(rootPath, "modules/department/infrastructure");
    const prismaRoot = resolve(rootPath, "prisma");
    if (pathIsWithin(filePath, departmentInfrastructureRoot)
        || pathIsWithin(filePath, prismaRoot)
        || isTestSource(filePath, rootPath)) {
        return null;
    }

    const contents = readFileSync(filePath, "utf8");
    const accessMatch = /\bprisma\s*\.\s*department\b/.exec(contents);
    if (accessMatch === null || accessMatch.index === undefined) return null;

    const line = contents.slice(0, accessMatch.index).split(/\r?\n/).length;
    return `${relativeFilePath(filePath, rootPath)}:${line} direct Department Prisma access must be owned by modules/department/infrastructure/.`;
}

function getClientReachableServerEntryViolations(rootPath, sourceFiles, moduleName) {
    const serverEntry = resolve(rootPath, `modules/${moduleName}`);
    const displayName = moduleName[0].toUpperCase() + moduleName.slice(1);
    const pending = sourceFiles.filter((filePath) => (
        !isTestSource(filePath, rootPath) && hasUseClientDirective(filePath)
    ));
    const visited = new Set();
    const violations = [];

    while (pending.length > 0) {
        const filePath = pending.pop();
        if (visited.has(filePath)) continue;
        visited.add(filePath);

        for (const record of getImports(filePath, true)) {
            const { importTarget, sourcePath } = getRuntimeImportTarget(
                record.moduleSpecifier,
                filePath,
                rootPath,
            );
            const importsServerEntry = importTarget === serverEntry
                || (sourcePath !== null
                    && pathIsWithin(sourcePath, serverEntry)
                    && /^index\.[cm]?[jt]sx?$/.test(relative(serverEntry, sourcePath)));

            if (importsServerEntry) {
                violations.push(describeViolation(
                    filePath,
                    rootPath,
                    record,
                    `Client-reachable runtime code must not import the ${displayName} server entry; use @/modules/${moduleName}/client.`,
                ));
                continue;
            }

            if (sourcePath !== null) pending.push(sourcePath);
        }
    }

    return violations;
}

function getEmployeeClientGraphViolations(rootPath) {
    const entryPath = resolve(rootPath, "modules/employee/client.ts");
    if (!existsSync(entryPath)) return [];
    const pending = [entryPath];
    const visited = new Set();
    const violations = [];
    const serverPackages = [
        "@prisma/client", "nodemailer", "@line/bot-sdk", "server-only",
        "next/server", "next/headers", "next/cache",
    ];
    const serverDirectories = [
        "lib/db", "lib/server", "lib/email", "lib/line",
        "modules/employee/server", "modules/employee/application", "modules/employee/infrastructure",
    ];
    while (pending.length > 0) {
        const filePath = pending.pop();
        if (visited.has(filePath)) continue;
        visited.add(filePath);
        for (const record of getImports(filePath, true)) {
            const { importTarget, sourcePath } = getRuntimeImportTarget(
                record.moduleSpecifier,
                filePath,
                rootPath,
            );
            if (isBuiltin(record.moduleSpecifier)
                || serverPackages.some((name) => hasImportPrefix(record.moduleSpecifier, name))
                || (importTarget !== null && serverDirectories.some((directory) =>
                    pathIsWithin(importTarget, resolve(rootPath, directory))))) {
                violations.push(describeViolation(
                    filePath,
                    rootPath,
                    record,
                    "Server-only runtime dependency is reachable from @/modules/employee/client.",
                ));
                continue;
            }
            if (sourcePath !== null) pending.push(sourcePath);
        }
    }
    return violations;
}

function getLeaveClientGraphViolations(rootPath) {
    const entryPath = resolve(rootPath, "modules/leave/client.ts");
    if (!existsSync(entryPath)) return [];
    const pending = [entryPath];
    const visited = new Set();
    const violations = [];
    const serverPackages = [
        "@prisma/client",
        "nodemailer",
        "@line/bot-sdk",
        "server-only",
        "next/server",
        "next/headers",
        "next/cache",
    ];
    const serverDirectories = [
        "lib/db", "lib/server", "lib/email", "lib/line",
        "modules/leave/server", "modules/leave/infrastructure/persistence",
        "modules/leave/infrastructure/notifications", "modules/leave/infrastructure/reports",
    ];
    while (pending.length > 0) {
        const filePath = pending.pop();
        if (visited.has(filePath)) continue;
        visited.add(filePath);
        for (const record of getImports(filePath, true)) {
            const specifier = record.moduleSpecifier;
            const { importTarget, sourcePath } = getRuntimeImportTarget(
                specifier,
                filePath,
                rootPath,
            );
            if (isBuiltin(specifier) || serverPackages.some((name) => hasImportPrefix(specifier, name))
                || (importTarget !== null && serverDirectories.some((directory) =>
                    pathIsWithin(importTarget, resolve(rootPath, directory))))) {
                violations.push(describeViolation(filePath, rootPath, record,
                    "Server-only runtime dependency is reachable from @/modules/leave/client."));
                continue;
            }
            if (sourcePath !== null) pending.push(sourcePath);
        }
    }
    return violations;
}

function relativeFilePath(filePath, rootPath) {
    return relative(rootPath, filePath).split(sep).join("/");
}

function describeViolation(filePath, rootPath, importRecord, message) {
    return `${relativeFilePath(filePath, rootPath)}:${importRecord.line} imports "${importRecord.moduleSpecifier}": ${message}`;
}

function getBoundaryViolation(owner, target) {
    if (owner.kind === "shared" && target.kind === "modules") {
        return "shared/ cannot depend on business modules.";
    }

    if (target.kind !== "modules" || target.moduleName === null) {
        return null;
    }

    const publicApi = `@/modules/${target.moduleName}`;

    if (target.isPublicEntryPoint) {
        return null;
    }

    if (owner.kind === "module" && owner.name === target.moduleName) {
        return null;
    }

    if (owner.kind === "module") {
        return `cross-module dependencies must use the target module public entry point "${publicApi}".`;
    }

    return `external consumers must use the target module public API "${publicApi}".`;
}

function checkArchitecture(options = {}) {
    const rootPath = resolve(options.repositoryRoot ?? repositoryRoot);
    const modulesRoot = resolve(rootPath, "modules");
    const sharedRoot = resolve(rootPath, "shared");
    const architectureRoots = [modulesRoot, sharedRoot];
    const missingRoots = architectureRoots.filter((directoryPath) => !existsSync(directoryPath));
    const violations = missingRoots.map((directoryPath) => (
        `Missing architecture directory: ${relativeFilePath(directoryPath, rootPath)}/`
    ));

    if (missingRoots.length > 0) {
        return { sourceFiles: [], violations };
    }

    const sourceFiles = getSourceFiles(rootPath).sort();

    for (const filePath of sourceFiles) {
        const departmentPersistenceViolation = getDepartmentPersistenceViolation(
            filePath,
            rootPath,
        );
        if (departmentPersistenceViolation !== null) {
            violations.push(departmentPersistenceViolation);
        }

        const owner = getOwner(filePath, modulesRoot, sharedRoot);

        for (const importRecord of getImports(filePath)) {
            const departmentRouteDependencyViolation = getDepartmentRouteDependencyViolation(
                filePath,
                rootPath,
                importRecord.moduleSpecifier,
            );
            if (departmentRouteDependencyViolation !== null) {
                violations.push(describeViolation(
                    filePath,
                    rootPath,
                    importRecord,
                    departmentRouteDependencyViolation,
                ));
                continue;
            }

            const departmentDependencyViolation = getDepartmentDependencyViolation(
                filePath,
                rootPath,
                importRecord.moduleSpecifier,
            );
            if (departmentDependencyViolation !== null) {
                violations.push(describeViolation(
                    filePath,
                    rootPath,
                    importRecord,
                    departmentDependencyViolation,
                ));
                continue;
            }

            const deletedEmployeeCompatibilityViolation =
                getDeletedEmployeeCompatibilityViolation(
                    filePath,
                    rootPath,
                    importRecord.moduleSpecifier,
                );
            if (deletedEmployeeCompatibilityViolation !== null) {
                violations.push(describeViolation(
                    filePath,
                    rootPath,
                    importRecord,
                    deletedEmployeeCompatibilityViolation,
                ));
                continue;
            }

            const leaveRouteDependencyViolation = getLeaveRouteDependencyViolation(
                filePath,
                rootPath,
                importRecord.moduleSpecifier,
            );
            if (leaveRouteDependencyViolation !== null) {
                violations.push(describeViolation(
                    filePath,
                    rootPath,
                    importRecord,
                    leaveRouteDependencyViolation,
                ));
                continue;
            }

            const employeeDependencyViolation = getEmployeeDependencyViolation(
                filePath,
                rootPath,
                importRecord.moduleSpecifier,
            );
            if (employeeDependencyViolation !== null) {
                violations.push(describeViolation(
                    filePath,
                    rootPath,
                    importRecord,
                    employeeDependencyViolation,
                ));
                continue;
            }

            const employeeDashboardRouteDependencyViolation =
                getEmployeeDashboardRouteDependencyViolation(
                    filePath,
                    rootPath,
                    importRecord.moduleSpecifier,
                );
            if (employeeDashboardRouteDependencyViolation !== null) {
                violations.push(describeViolation(
                    filePath,
                    rootPath,
                    importRecord,
                    employeeDashboardRouteDependencyViolation,
                ));
                continue;
            }

            const moduleDependencyViolation = getModuleDependencyViolation(
                owner,
                importRecord.moduleSpecifier,
            );
            if (moduleDependencyViolation !== null) {
                violations.push(describeViolation(
                    filePath,
                    rootPath,
                    importRecord,
                    moduleDependencyViolation,
                ));
                continue;
            }

            const target = getArchitectureTarget(
                importRecord.moduleSpecifier,
                filePath,
                rootPath,
                modulesRoot,
                sharedRoot,
            );
            if (target === null) {
                continue;
            }

            const message = getBoundaryViolation(owner, target);
            if (message !== null) {
                violations.push(describeViolation(
                    filePath,
                    rootPath,
                    importRecord,
                    message,
                ));
            }
        }
    }

    violations.push(...getEmployeeDashboardRouteCompositionViolations(rootPath, sourceFiles));
    violations.push(...getLeaveClientGraphViolations(rootPath));
    violations.push(...getEmployeeClientGraphViolations(rootPath));
    violations.push(...getClientReachableServerEntryViolations(rootPath, sourceFiles, "leave"));
    violations.push(...getClientReachableServerEntryViolations(rootPath, sourceFiles, "employee"));
    return { sourceFiles, violations };
}

function reportResult(result) {
    if (result.violations.length === 0) {
        process.stdout.write(
            `Architecture check passed: checked ${result.sourceFiles.length} repository source file(s) for module boundaries.\n`,
        );
        return;
    }

    console.error(`Architecture check failed with ${result.violations.length} violation(s).`);
    for (const violation of result.violations) {
        console.error(`- ${violation}`);
    }
    process.exitCode = 1;
}

export { checkArchitecture };

const isMainModule = process.argv[1] !== undefined
    && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
    reportResult(checkArchitecture());
}
