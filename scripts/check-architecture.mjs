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
        if (isLeavePresentation && ["@/modules/leave", "@/modules/leave/client"].includes(normalizedSpecifier)) {
            return "Leave presentation internals must use local contracts instead of their own public barrel.";
        }
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

    return null;
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
            const target = specifier.startsWith("@/")
                ? resolve(rootPath, specifier.slice(2))
                : getImportSourcePath(specifier, filePath, rootPath);
            if (isBuiltin(specifier) || serverPackages.some((name) => hasImportPrefix(specifier, name))
                || (target !== null && serverDirectories.some((directory) =>
                    pathIsWithin(target, resolve(rootPath, directory))))) {
                violations.push(describeViolation(filePath, rootPath, record,
                    "Server-only runtime dependency is reachable from @/modules/leave/client."));
                continue;
            }
            if (target === null) continue;
            const sourcePath = [
                ...[...sourceExtensions].map((extension) => `${target}${extension}`),
                ...[...sourceExtensions].map((extension) => resolve(target, `index${extension}`)),
                ...(sourceExtensions.has(extname(target)) ? [target] : []),
            ].find((candidate) => existsSync(candidate));
            if (sourcePath !== undefined) pending.push(sourcePath);
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
        const owner = getOwner(filePath, modulesRoot, sharedRoot);

        for (const importRecord of getImports(filePath)) {
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

    violations.push(...getLeaveClientGraphViolations(rootPath));
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
