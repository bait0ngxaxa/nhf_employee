import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, extname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const modulesRoot = resolve(repositoryRoot, "modules");
const sharedRoot = resolve(repositoryRoot, "shared");
const architectureRoots = [modulesRoot, sharedRoot];
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

function pathIsWithin(candidatePath, parentPath) {
    const relativePath = relative(parentPath, candidatePath);
    return (
        relativePath === ""
        || (!relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath))
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
            return getSourceFiles(entryPath);
        }

        return sourceExtensions.has(extname(entry.name)) ? [entryPath] : [];
    });
}

function getImportSourcePath(specifier, importerPath) {
    if (specifier === "@/modules" || specifier.startsWith("@/modules/")) {
        return resolve(repositoryRoot, specifier.slice(2));
    }

    if (specifier === "@/shared" || specifier.startsWith("@/shared/")) {
        return resolve(repositoryRoot, specifier.slice(2));
    }

    if (specifier === "modules" || specifier.startsWith("modules/")) {
        return resolve(repositoryRoot, specifier);
    }

    if (specifier === "shared" || specifier.startsWith("shared/")) {
        return resolve(repositoryRoot, specifier);
    }

    if (specifier.startsWith(".")) {
        return resolve(dirname(importerPath), specifier);
    }

    return null;
}

function getOwner(filePath) {
    const moduleSegments = getPathSegments(filePath, modulesRoot);
    if (moduleSegments !== null) {
        return {
            kind: "module",
            name: moduleSegments[0] ?? null,
        };
    }

    if (getPathSegments(filePath, sharedRoot) !== null) {
        return { kind: "shared", name: null };
    }

    return null;
}

function getArchitectureTarget(specifier, importerPath) {
    const importPath = getImportSourcePath(specifier, importerPath);
    if (importPath === null) {
        return null;
    }

    const moduleSegments = getPathSegments(importPath, modulesRoot);
    if (moduleSegments !== null) {
        return {
            kind: "modules",
            moduleName: moduleSegments[0] ?? null,
            isPublicEntryPoint: moduleSegments.length === 1,
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

function getImports(filePath) {
    const sourceFile = ts.createSourceFile(
        filePath,
        readFileSync(filePath, "utf8"),
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
            if (isDynamicImport || isRequireCall) {
                addImport(node, getStringLiteralText(node.arguments[0]));
            }
        }

        ts.forEachChild(node, visit);
    }

    visit(sourceFile);
    return imports;
}

function relativeFilePath(filePath) {
    return relative(repositoryRoot, filePath).split(sep).join("/");
}

function describeViolation(filePath, importRecord, message) {
    return `${relativeFilePath(filePath)}:${importRecord.line} imports "${importRecord.moduleSpecifier}": ${message}`;
}

const missingRoots = architectureRoots.filter((directoryPath) => !existsSync(directoryPath));
const violations = missingRoots.map((directoryPath) => (
    `Missing architecture directory: ${relativeFilePath(directoryPath)}/`
));

if (missingRoots.length === 0) {
    const sourceFiles = architectureRoots.flatMap(getSourceFiles).sort();

    for (const filePath of sourceFiles) {
        const owner = getOwner(filePath);
        if (owner === null) {
            continue;
        }

        for (const importRecord of getImports(filePath)) {
            const target = getArchitectureTarget(importRecord.moduleSpecifier, filePath);
            if (target === null) {
                continue;
            }

            if (owner.kind === "shared" && target.kind === "modules") {
                violations.push(describeViolation(
                    filePath,
                    importRecord,
                    "shared/ cannot depend on business modules.",
                ));
                continue;
            }

            if (
                owner.kind === "module"
                && target.kind === "modules"
                && owner.name !== target.moduleName
                && !target.isPublicEntryPoint
            ) {
                violations.push(describeViolation(
                    filePath,
                    importRecord,
                    "cross-module dependencies must use the target module public entry point, such as @/modules/<feature>.",
                ));
            }
        }
    }

    if (violations.length === 0) {
        process.stdout.write(
            `Architecture check passed: checked ${sourceFiles.length} source file(s) under modules/ and shared/.\n`,
        );
    }
}

if (violations.length > 0) {
    console.error(`Architecture check failed with ${violations.length} violation(s).`);
    for (const violation of violations) {
        console.error(`- ${violation}`);
    }
    process.exitCode = 1;
}
