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
const notificationApiRouteFiles = [
    "app/api/notifications/route.ts",
    "app/api/notifications/all/route.ts",
    "app/api/notifications/[id]/read/route.ts",
    "app/api/notifications/mark-all-read/route.ts",
];
const auditApiRouteFiles = [
    "app/api/audit-logs/route.ts",
    "app/api/audit-logs/cleanup/route.ts",
];
const auditLogCompatibilityAccesses = new Map([
    ["modules/employee/application/mutations.ts", ["create"]],
    ["modules/leave/infrastructure/persistence/transaction.ts", ["create"]],
    ["modules/leave/application/approvals/approver-assignment.ts", ["create"]],
    ["modules/stock/infrastructure/persistence/command-audit.ts", ["create"]],
    ["modules/routine/application/audit.ts", ["create"]],
    [
        "modules/routine/application/imports/staging.ts",
        ["create", "create", "create", "create"],
    ],
    ["modules/routine/application/queries.ts", ["findMany"]],
]);
const notificationDashboardRouteFiles = [
    "app/dashboard/notifications/page.tsx",
    "app/dashboard/notifications/loading.tsx",
];
const dashboardNavbarFile = "components/dashboard/layout/DashboardNavbar.tsx";
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
const legacyNotificationPresentationPrefixes = [
    "@/components/dashboard/notifications",
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

function getDeletedNotificationPresentationViolation(filePath, rootPath, moduleSpecifier) {
    const resolvedImport = moduleSpecifier.startsWith("@/")
        ? resolve(rootPath, moduleSpecifier.slice(2))
        : getImportSourcePath(moduleSpecifier, filePath, rootPath);
    const normalizedSpecifier = resolvedImport === null
        ? moduleSpecifier
        : `@/${relativeFilePath(resolvedImport, rootPath).replace(/\.[cm]?[jt]sx?$/, "")}`;
    const deletedPath = legacyNotificationPresentationPrefixes.find((prefix) =>
        hasImportPrefix(normalizedSpecifier, prefix),
    );

    return deletedPath === undefined
        ? null
        : `Deleted Notification presentation path "${deletedPath}" must not be imported; use @/modules/notification/client.`;
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

function getStaticPropertyName(node) {
    if (ts.isPropertyAccessExpression(node)) return node.name.text;
    if (ts.isElementAccessExpression(node)
        && node.argumentExpression !== undefined
        && ts.isStringLiteralLike(node.argumentExpression)) {
        return node.argumentExpression.text;
    }
    return null;
}

function getStaticBindingPropertyName(node) {
    return getStaticPropertyName(node)
        ?? (ts.isIdentifier(node) ? node.text : null);
}

function getAuditLogAliases(sourceFile) {
    const declarations = [];
    const aliases = new Set();

    function collectDeclarations(node) {
        if (ts.isVariableDeclaration(node)) declarations.push(node);
        ts.forEachChild(node, collectDeclarations);
    }

    collectDeclarations(sourceFile);

    let changed = true;
    while (changed) {
        changed = false;
        for (const declaration of declarations) {
            const initializer = declaration.initializer;
            if (initializer === undefined) continue;

            if (ts.isIdentifier(declaration.name)
                && (
                    getStaticPropertyName(initializer) === "auditLog"
                    || (ts.isIdentifier(initializer) && aliases.has(initializer.text))
                )
                && !aliases.has(declaration.name.text)) {
                aliases.add(declaration.name.text);
                changed = true;
            }

            if (!ts.isObjectBindingPattern(declaration.name)) continue;
            for (const element of declaration.name.elements) {
                if (!ts.isBindingElement(element)) continue;
                const propertyName = element.propertyName ?? element.name;
                if (getStaticBindingPropertyName(propertyName) !== "auditLog"
                    || !ts.isIdentifier(element.name)
                    || aliases.has(element.name.text)) {
                    continue;
                }
                aliases.add(element.name.text);
                changed = true;
            }
        }
    }

    return aliases;
}

function getAuditLogDelegateAccesses(filePath) {
    const contents = readFileSync(filePath, "utf8");
    const sourceFile = ts.createSourceFile(
        filePath,
        contents,
        ts.ScriptTarget.Latest,
        true,
        getScriptKind(filePath),
    );
    const aliases = getAuditLogAliases(sourceFile);
    const accesses = [];

    function visit(node) {
        if (ts.isCallExpression(node)
            && (ts.isPropertyAccessExpression(node.expression)
                || ts.isElementAccessExpression(node.expression))) {
            const operation = getStaticPropertyName(node.expression);
            const delegate = node.expression.expression;
            const isAuditLogDelegate = getStaticPropertyName(delegate) === "auditLog"
                || (ts.isIdentifier(delegate) && aliases.has(delegate.text));
            if (operation !== null && isAuditLogDelegate) {
                accesses.push({
                    line: sourceFile.getLineAndCharacterOfPosition(
                        node.expression.getStart(sourceFile),
                    ).line + 1,
                    operation,
                });
            }
        }

        ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return accesses;
}

function isAuditLogSupportSource(filePath, rootPath) {
    if (isTestSource(filePath, rootPath)) return true;
    if (pathIsWithin(filePath, resolve(rootPath, "prisma"))) return true;

    const segments = relativeFilePath(filePath, rootPath)
        .split("/")
        .map((segment) => segment.toLowerCase());
    return segments.some((segment) => [
        "fixture",
        "fixtures",
        "__fixtures__",
        "test-support",
        "test-utils",
    ].includes(segment));
}

function getAuditLogPersistenceViolation(filePath, rootPath) {
    const auditInfrastructureRoot = resolve(rootPath, "modules/audit/infrastructure");
    if (pathIsWithin(filePath, auditInfrastructureRoot)
        || isAuditLogSupportSource(filePath, rootPath)) {
        return null;
    }

    const accesses = getAuditLogDelegateAccesses(filePath);
    if (accesses.length === 0) return null;

    const repositoryPath = relativeFilePath(filePath, rootPath);
    const expectedAccesses = auditLogCompatibilityAccesses.get(repositoryPath);
    if (expectedAccesses === undefined) {
        const firstAccess = accesses[0];
        return `${repositoryPath}:${firstAccess.line} direct AuditLog Prisma delegate access must be owned by modules/audit/infrastructure/ or match an explicitly allowed temporary producer expression.`;
    }

    const actualCounts = new Map();
    for (const access of accesses) {
        actualCounts.set(access.operation, (actualCounts.get(access.operation) ?? 0) + 1);
    }
    const expectedCounts = new Map();
    for (const operation of expectedAccesses) {
        expectedCounts.set(operation, (expectedCounts.get(operation) ?? 0) + 1);
    }
    const countsMatch = actualCounts.size === expectedCounts.size
        && [...expectedCounts].every(([operation, count]) =>
            actualCounts.get(operation) === count,
        );
    if (countsMatch) return null;

    const formatCounts = (counts) => [...counts.entries()]
        .map(([operation, count]) => `${operation} x${count}`)
        .join(", ");
    const firstAccess = accesses[0];
    return `${repositoryPath}:${firstAccess.line} direct AuditLog access does not match the allowed temporary compatibility shape; expected ${formatCounts(expectedCounts)}, found ${formatCounts(actualCounts)}.`;
}

const notificationDelegateOperations = new Set([
    "create",
    "createMany",
    "update",
    "updateMany",
    "findMany",
    "findFirst",
    "findUnique",
    "count",
    "delete",
    "deleteMany",
    "upsert",
]);

function getNotificationDelegateAccess(filePath) {
    const contents = readFileSync(filePath, "utf8");
    const sourceFile = ts.createSourceFile(
        filePath,
        contents,
        ts.ScriptTarget.Latest,
        true,
        getScriptKind(filePath),
    );
    let accessNode = null;

    function visit(node) {
        if (accessNode !== null) return;

        if (ts.isCallExpression(node)
            && ts.isPropertyAccessExpression(node.expression)
            && notificationDelegateOperations.has(node.expression.name.text)
        ) {
            const delegate = node.expression.expression;
            if (ts.isPropertyAccessExpression(delegate)
                && delegate.name.text === "notification"
            ) {
                accessNode = node.expression;
                return;
            }
        }

        ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return accessNode;
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

function isNotificationApiRoute(filePath, rootPath) {
    return notificationApiRouteFiles.some((routePath) =>
        filePath === resolve(rootPath, routePath),
    );
}

function getNotificationRouteDependencyViolation(filePath, rootPath, moduleSpecifier) {
    if (!isNotificationApiRoute(filePath, rootPath)) return null;

    const resolvedImport = moduleSpecifier.startsWith("@/")
        ? resolve(rootPath, moduleSpecifier.slice(2))
        : getImportSourcePath(moduleSpecifier, filePath, rootPath);
    const normalizedSpecifier = resolvedImport === null
        ? moduleSpecifier
        : `@/${relativeFilePath(resolvedImport, rootPath).replace(/\.[cm]?[jt]sx?$/, "")}`;

    if (hasImportPrefix(normalizedSpecifier, "@/modules/notification")
        && normalizedSpecifier !== "@/modules/notification") {
        return "Notification API routes must use the server entry @/modules/notification.";
    }

    return null;
}

function isAuditApiRoute(filePath, rootPath) {
    return auditApiRouteFiles.some((routePath) =>
        filePath === resolve(rootPath, routePath),
    );
}

function getAuditApiRouteDependencyViolation(filePath, rootPath, moduleSpecifier) {
    if (!isAuditApiRoute(filePath, rootPath)) return null;

    const resolvedImport = moduleSpecifier.startsWith("@/")
        ? resolve(rootPath, moduleSpecifier.slice(2))
        : getImportSourcePath(moduleSpecifier, filePath, rootPath);
    const normalizedSpecifier = resolvedImport === null
        ? moduleSpecifier
        : `@/${relativeFilePath(resolvedImport, rootPath).replace(/\.[cm]?[jt]sx?$/, "")}`;

    if (hasImportPrefix(normalizedSpecifier, "@/modules/audit")
        && normalizedSpecifier !== "@/modules/audit") {
        return "Audit API routes must use the server entry @/modules/audit.";
    }

    return null;
}

function getAuditDependencyViolation(filePath, rootPath, moduleSpecifier) {
    const auditModuleRoot = resolve(rootPath, "modules/audit");
    if (!pathIsWithin(filePath, auditModuleRoot)
        || filePath === resolve(auditModuleRoot, "index.ts")) {
        return null;
    }

    const resolvedImport = moduleSpecifier.startsWith("@/")
        ? resolve(rootPath, moduleSpecifier.slice(2))
        : getImportSourcePath(moduleSpecifier, filePath, rootPath);
    const normalizedSpecifier = resolvedImport === null
        ? moduleSpecifier
        : `@/${relativeFilePath(resolvedImport, rootPath).replace(/\.[cm]?[jt]sx?$/, "")}`;

    if (["@/modules/audit", "@/modules/audit/index"].includes(normalizedSpecifier)) {
        return "Audit module internals must use local contracts instead of their own public barrel.";
    }

    return null;
}

function getAuditApiRouteCompositionViolations(rootPath, sourceFiles) {
    const publicEntry = "@/modules/audit";
    const violations = [];

    for (const routePath of auditApiRouteFiles) {
        const filePath = resolve(rootPath, routePath);
        if (!sourceFiles.includes(filePath)) continue;

        const normalizedSpecifiers = getImports(filePath).map((record) => {
            const resolvedImport = record.moduleSpecifier.startsWith("@/")
                ? resolve(rootPath, record.moduleSpecifier.slice(2))
                : getImportSourcePath(record.moduleSpecifier, filePath, rootPath);
            return resolvedImport === null
                ? record.moduleSpecifier
                : `@/${relativeFilePath(resolvedImport, rootPath).replace(/\.[cm]?[jt]sx?$/, "")}`;
        });

        if (normalizedSpecifiers.includes(publicEntry)) continue;

        const hasAuditDependency = normalizedSpecifiers.some((specifier) =>
            hasImportPrefix(specifier, publicEntry),
        );
        if (hasAuditDependency) continue;

        violations.push(
            `${relativeFilePath(filePath, rootPath)} must consume Audit through "${publicEntry}".`,
        );
    }

    return violations;
}

function getNotificationDashboardRouteDependencyViolation(filePath, rootPath, moduleSpecifier) {
    if (!notificationDashboardRouteFiles.some((routePath) =>
        filePath === resolve(rootPath, routePath),
    )) {
        return null;
    }

    const resolvedImport = moduleSpecifier.startsWith("@/")
        ? resolve(rootPath, moduleSpecifier.slice(2))
        : getImportSourcePath(moduleSpecifier, filePath, rootPath);
    const normalizedSpecifier = resolvedImport === null
        ? moduleSpecifier
        : `@/${relativeFilePath(resolvedImport, rootPath).replace(/\.[cm]?[jt]sx?$/, "")}`;

    if (legacyNotificationPresentationPrefixes.some((prefix) =>
        hasImportPrefix(normalizedSpecifier, prefix),
    )) {
        return "Notification Dashboard routes must use @/modules/notification/client instead of the deleted Notification presentation path.";
    }

    if (hasImportPrefix(normalizedSpecifier, "@/modules/notification")
        && normalizedSpecifier !== "@/modules/notification/client") {
        return "Notification Dashboard routes must use @/modules/notification/client.";
    }

    return null;
}

function getNotificationNavbarDependencyViolation(filePath, rootPath, moduleSpecifier) {
    if (filePath !== resolve(rootPath, dashboardNavbarFile)) {
        return null;
    }

    const resolvedImport = moduleSpecifier.startsWith("@/")
        ? resolve(rootPath, moduleSpecifier.slice(2))
        : getImportSourcePath(moduleSpecifier, filePath, rootPath);
    const normalizedSpecifier = resolvedImport === null
        ? moduleSpecifier
        : `@/${relativeFilePath(resolvedImport, rootPath).replace(/\.[cm]?[jt]sx?$/, "")}`;

    if (legacyNotificationPresentationPrefixes.some((prefix) =>
        hasImportPrefix(normalizedSpecifier, prefix),
    )) {
        return "DashboardNavbar must use @/modules/notification/client instead of the deleted Notification presentation path.";
    }

    if (hasImportPrefix(normalizedSpecifier, "@/modules/notification")
        && normalizedSpecifier !== "@/modules/notification/client") {
        return "DashboardNavbar must consume Notification through @/modules/notification/client.";
    }

    return null;
}

function getNotificationDashboardRouteCompositionViolations(rootPath, sourceFiles) {
    const clientEntry = "@/modules/notification/client";
    const violations = [];

    for (const routePath of notificationDashboardRouteFiles) {
        const filePath = resolve(rootPath, routePath);
        if (!sourceFiles.includes(filePath)) continue;

        const normalizedSpecifiers = getImports(filePath).map((record) => {
            const resolvedImport = record.moduleSpecifier.startsWith("@/")
                ? resolve(rootPath, record.moduleSpecifier.slice(2))
                : getImportSourcePath(record.moduleSpecifier, filePath, rootPath);
            return resolvedImport === null
                ? record.moduleSpecifier
                : `@/${relativeFilePath(resolvedImport, rootPath).replace(/\.[cm]?[jt]sx?$/, "")}`;
        });

        if (normalizedSpecifiers.includes(clientEntry)) continue;

        const hasNotificationPresentationImport = normalizedSpecifiers.some((specifier) =>
            hasImportPrefix(specifier, "@/modules/notification")
            || legacyNotificationPresentationPrefixes.some((prefix) =>
                hasImportPrefix(specifier, prefix),
            ),
        );
        if (hasNotificationPresentationImport) continue;

        violations.push(
            `${relativeFilePath(filePath, rootPath)} must consume Notification presentation through "${clientEntry}".`,
        );
    }

    return violations;
}

function getNotificationNavbarCompositionViolations(rootPath, sourceFiles) {
    const filePath = resolve(rootPath, dashboardNavbarFile);
    if (!sourceFiles.includes(filePath)) return [];

    const clientEntry = "@/modules/notification/client";
    const normalizedSpecifiers = getImports(filePath).map((record) => {
        const resolvedImport = record.moduleSpecifier.startsWith("@/")
            ? resolve(rootPath, record.moduleSpecifier.slice(2))
            : getImportSourcePath(record.moduleSpecifier, filePath, rootPath);
        return resolvedImport === null
            ? record.moduleSpecifier
            : `@/${relativeFilePath(resolvedImport, rootPath).replace(/\.[cm]?[jt]sx?$/, "")}`;
    });

    if (normalizedSpecifiers.includes(clientEntry)) return [];

    const hasNotificationDependency = normalizedSpecifiers.some((specifier) =>
        hasImportPrefix(specifier, "@/modules/notification")
        || legacyNotificationPresentationPrefixes.some((prefix) =>
            hasImportPrefix(specifier, prefix),
        ),
    );
    if (hasNotificationDependency) return [];

    return [
        `${relativeFilePath(filePath, rootPath)} must consume Notification through "${clientEntry}".`,
    ];
}

function getNotificationRouteCompositionViolations(rootPath, sourceFiles) {
    const publicEntry = "@/modules/notification";
    const violations = [];

    for (const routePath of notificationApiRouteFiles) {
        const filePath = resolve(rootPath, routePath);
        if (!sourceFiles.includes(filePath)) continue;

        const normalizedSpecifiers = getImports(filePath).map((record) => {
            const resolvedImport = record.moduleSpecifier.startsWith("@/")
                ? resolve(rootPath, record.moduleSpecifier.slice(2))
                : getImportSourcePath(record.moduleSpecifier, filePath, rootPath);
            return resolvedImport === null
                ? record.moduleSpecifier
                : `@/${relativeFilePath(resolvedImport, rootPath).replace(/\.[cm]?[jt]sx?$/, "")}`;
        });

        if (normalizedSpecifiers.includes(publicEntry)
            || normalizedSpecifiers.some((specifier) =>
                hasImportPrefix(specifier, publicEntry),
            )) {
            continue;
        }

        violations.push(
            `${relativeFilePath(filePath, rootPath)} must consume Notification through "${publicEntry}".`,
        );
    }

    return violations;
}

function getNotificationPersistenceViolation(filePath, rootPath) {
    const notificationInfrastructureRoot = resolve(
        rootPath,
        "modules/notification/infrastructure",
    );
    const prismaRoot = resolve(rootPath, "prisma");
    if (pathIsWithin(filePath, notificationInfrastructureRoot)
        || pathIsWithin(filePath, prismaRoot)
        || isTestSource(filePath, rootPath)
    ) {
        return null;
    }

    const accessNode = getNotificationDelegateAccess(filePath);
    if (accessNode === null) return null;

    const line = accessNode.getSourceFile().getLineAndCharacterOfPosition(
        accessNode.getStart(accessNode.getSourceFile()),
    ).line + 1;
    if (isNotificationApiRoute(filePath, rootPath)) {
        return `${relativeFilePath(filePath, rootPath)}:${line} Notification API routes must delegate Notification persistence through @/modules/notification.`;
    }

    return `${relativeFilePath(filePath, rootPath)}:${line} direct Notification Prisma delegate access must be owned by modules/notification/infrastructure/.`;
}

function getLegacyNotificationCompatibilityViolation(filePath, rootPath, moduleSpecifier) {
    if (isTestSource(filePath, rootPath)) return null;

    const modulesRoot = resolve(rootPath, "modules");
    if (!pathIsWithin(filePath, modulesRoot)) return null;

    const resolvedImport = moduleSpecifier.startsWith("@/")
        ? resolve(rootPath, moduleSpecifier.slice(2))
        : getImportSourcePath(moduleSpecifier, filePath, rootPath);
    const normalizedSpecifier = resolvedImport === null
        ? moduleSpecifier
        : `@/${relativeFilePath(resolvedImport, rootPath).replace(/\.[cm]?[jt]sx?$/, "")}`;
    if (normalizedSpecifier !== "@/lib/services/notifications/in-app") {
        return null;
    }

    return "Business modules must use @/modules/notification instead of the deferred in-app compatibility adapter.";
}

function getNotificationDependencyViolation(filePath, rootPath, moduleSpecifier) {
    const notificationModuleRoot = resolve(rootPath, "modules/notification");
    if (!pathIsWithin(filePath, notificationModuleRoot)
        || filePath === resolve(notificationModuleRoot, "index.ts")) {
        return null;
    }

    const resolvedImport = moduleSpecifier.startsWith("@/")
        ? resolve(rootPath, moduleSpecifier.slice(2))
        : getImportSourcePath(moduleSpecifier, filePath, rootPath);
    const normalizedSpecifier = resolvedImport === null
        ? moduleSpecifier
        : `@/${relativeFilePath(resolvedImport, rootPath).replace(/\.[cm]?[jt]sx?$/, "")}`;
    const publicEntries = new Set([
        "@/modules/notification",
        "@/modules/notification/index",
        "@/modules/notification/client",
    ]);

    if (publicEntries.has(normalizedSpecifier)) {
        return "Notification module internals must use local contracts instead of their own public barrel.";
    }

    return null;
}

function getClientReachableServerEntryViolations(
    rootPath,
    sourceFiles,
    moduleName,
    clientEntry = `@/modules/${moduleName}/client`,
) {
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
                const boundaryMessage = clientEntry === null
                    ? `Browser ${displayName} data must be consumed through the existing HTTP/API boundary.`
                    : `use ${clientEntry}.`;
                violations.push(describeViolation(
                    filePath,
                    rootPath,
                    record,
                    `Client-reachable runtime code must not import the ${displayName} server entry; ${boundaryMessage}`,
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

function getNotificationClientGraphViolations(rootPath) {
    const entryPath = resolve(rootPath, "modules/notification/client.ts");
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
        "lib/db",
        "lib/server",
        "lib/email",
        "lib/line",
        "lib/services/outbox",
        "modules/notification/application",
        "modules/notification/infrastructure",
    ];

    while (pending.length > 0) {
        const filePath = pending.pop();
        if (filePath === undefined || visited.has(filePath)) continue;
        visited.add(filePath);

        for (const record of getImports(filePath, true)) {
            const specifier = record.moduleSpecifier;
            const { importTarget, sourcePath } = getRuntimeImportTarget(
                specifier,
                filePath,
                rootPath,
            );
            if (isBuiltin(specifier)
                || serverPackages.some((name) => hasImportPrefix(specifier, name))
                || (importTarget !== null && serverDirectories.some((directory) =>
                    pathIsWithin(importTarget, resolve(rootPath, directory)),
                ))) {
                violations.push(describeViolation(
                    filePath,
                    rootPath,
                    record,
                    "Server-only runtime dependency is reachable from @/modules/notification/client.",
                ));
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

        const notificationPersistenceViolation = getNotificationPersistenceViolation(
            filePath,
            rootPath,
        );
        if (notificationPersistenceViolation !== null) {
            violations.push(notificationPersistenceViolation);
        }

        const auditLogPersistenceViolation = getAuditLogPersistenceViolation(
            filePath,
            rootPath,
        );
        if (auditLogPersistenceViolation !== null) {
            violations.push(auditLogPersistenceViolation);
        }

        const owner = getOwner(filePath, modulesRoot, sharedRoot);

        for (const importRecord of getImports(filePath)) {
            const auditApiRouteDependencyViolation = getAuditApiRouteDependencyViolation(
                filePath,
                rootPath,
                importRecord.moduleSpecifier,
            );
            if (auditApiRouteDependencyViolation !== null) {
                violations.push(describeViolation(
                    filePath,
                    rootPath,
                    importRecord,
                    auditApiRouteDependencyViolation,
                ));
                continue;
            }

            const auditDependencyViolation = getAuditDependencyViolation(
                filePath,
                rootPath,
                importRecord.moduleSpecifier,
            );
            if (auditDependencyViolation !== null) {
                violations.push(describeViolation(
                    filePath,
                    rootPath,
                    importRecord,
                    auditDependencyViolation,
                ));
                continue;
            }

            const notificationDashboardRouteDependencyViolation =
                getNotificationDashboardRouteDependencyViolation(
                    filePath,
                    rootPath,
                    importRecord.moduleSpecifier,
                );
            if (notificationDashboardRouteDependencyViolation !== null) {
                violations.push(describeViolation(
                    filePath,
                    rootPath,
                    importRecord,
                    notificationDashboardRouteDependencyViolation,
                ));
                continue;
            }

            const notificationNavbarDependencyViolation =
                getNotificationNavbarDependencyViolation(
                    filePath,
                    rootPath,
                    importRecord.moduleSpecifier,
                );
            if (notificationNavbarDependencyViolation !== null) {
                violations.push(describeViolation(
                    filePath,
                    rootPath,
                    importRecord,
                    notificationNavbarDependencyViolation,
                ));
                continue;
            }

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

            const deletedNotificationPresentationViolation =
                getDeletedNotificationPresentationViolation(
                    filePath,
                    rootPath,
                    importRecord.moduleSpecifier,
                );
            if (deletedNotificationPresentationViolation !== null) {
                violations.push(describeViolation(
                    filePath,
                    rootPath,
                    importRecord,
                    deletedNotificationPresentationViolation,
                ));
                continue;
            }

            const legacyNotificationCompatibilityViolation =
                getLegacyNotificationCompatibilityViolation(
                    filePath,
                    rootPath,
                    importRecord.moduleSpecifier,
                );
            if (legacyNotificationCompatibilityViolation !== null) {
                violations.push(describeViolation(
                    filePath,
                    rootPath,
                    importRecord,
                    legacyNotificationCompatibilityViolation,
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

            const notificationRouteDependencyViolation =
                getNotificationRouteDependencyViolation(
                    filePath,
                    rootPath,
                    importRecord.moduleSpecifier,
                );
            if (notificationRouteDependencyViolation !== null) {
                violations.push(describeViolation(
                    filePath,
                    rootPath,
                    importRecord,
                    notificationRouteDependencyViolation,
                ));
                continue;
            }

            const notificationDependencyViolation = getNotificationDependencyViolation(
                filePath,
                rootPath,
                importRecord.moduleSpecifier,
            );
            if (notificationDependencyViolation !== null) {
                violations.push(describeViolation(
                    filePath,
                    rootPath,
                    importRecord,
                    notificationDependencyViolation,
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
    violations.push(...getAuditApiRouteCompositionViolations(rootPath, sourceFiles));
    violations.push(...getNotificationDashboardRouteCompositionViolations(rootPath, sourceFiles));
    violations.push(...getNotificationNavbarCompositionViolations(rootPath, sourceFiles));
    violations.push(...getNotificationRouteCompositionViolations(rootPath, sourceFiles));
    violations.push(...getLeaveClientGraphViolations(rootPath));
    violations.push(...getEmployeeClientGraphViolations(rootPath));
    violations.push(...getNotificationClientGraphViolations(rootPath));
    violations.push(...getClientReachableServerEntryViolations(rootPath, sourceFiles, "leave"));
    violations.push(...getClientReachableServerEntryViolations(rootPath, sourceFiles, "employee"));
    violations.push(...getClientReachableServerEntryViolations(rootPath, sourceFiles, "department", null));
    violations.push(...getClientReachableServerEntryViolations(rootPath, sourceFiles, "notification"));
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
