/* eslint-disable no-console -- This read-only operational command reports to stdout. */
import { prisma } from "../lib/db/prisma";
import {
    createAuthorizationProductionReadinessRepository,
    determineAuthorizationProductionReadinessExitCode,
    projectAuthorizationProductionReadinessReport,
    runAuthorizationProductionPreflight,
} from "@/modules/authorization";

interface PreflightOptions {
    readonly json: boolean;
    readonly details: boolean;
}

interface AuthorizationPreflightDatabaseTarget {
    readonly environment: string;
    readonly nodeEnvironment: string;
    readonly host: string;
    readonly port: string;
    readonly databaseName: string;
}

function parseOptions(args: readonly string[]): PreflightOptions {
    return {
        json: args.includes("--json"),
        details: args.includes("--details"),
    };
}

function parseDatabaseTarget(
    rawUrl: string | undefined,
    environment: string | undefined,
    nodeEnvironment: string | undefined,
): AuthorizationPreflightDatabaseTarget {
    if (!rawUrl) {
        throw new Error("DATABASE_URL is required");
    }
    if (!environment || !/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/.test(environment)) {
        throw new Error("AUTHORIZATION_PREFLIGHT_ENVIRONMENT is required");
    }
    if (!nodeEnvironment) {
        throw new Error("NODE_ENV is required");
    }
    if (environment === "production" && nodeEnvironment !== "production") {
        throw new Error("production preflight requires NODE_ENV=production");
    }

    const url = new URL(rawUrl);
    if (url.protocol !== "mysql:") {
        throw new Error("authorization preflight supports MySQL only");
    }
    const databaseName = decodeURIComponent(url.pathname.slice(1));
    if (!databaseName) {
        throw new Error("DATABASE_URL has no database name");
    }

    return Object.freeze({
        environment,
        nodeEnvironment,
        host: url.hostname || "localhost",
        port: url.port || "3306",
        databaseName,
    });
}

function printTerminalReport(
    target: AuthorizationPreflightDatabaseTarget,
    report: ReturnType<typeof projectAuthorizationProductionReadinessReport>,
): void {
    console.log("Authorization production preflight (read-only)");
    console.log(`Environment: ${target.environment}`);
    console.log(`NODE_ENV: ${target.nodeEnvironment}`);
    console.log(`Database target: ${target.host}:${target.port}/${target.databaseName}`);
    console.log(`Status: ${report.status}`);
    console.table([
        { measure: "Teams", count: report.summary.teamCount },
        { measure: "Active Teams", count: report.summary.activeTeamCount },
        { measure: "Inactive Teams", count: report.summary.inactiveTeamCount },
        { measure: "TeamRoles", count: report.summary.teamRoleCount },
        { measure: "TeamMemberships", count: report.summary.membershipCount },
        { measure: "Team grants", count: report.summary.teamGrantCount },
        { measure: "TeamRole grants", count: report.summary.teamRoleGrantCount },
        { measure: "Direct User grants", count: report.summary.directUserGrantCount },
        { measure: "Invalid configuration findings", count: report.summary.invalidConfigurationCount },
        { measure: "Warning findings", count: report.summary.warningCount },
        { measure: "Blocker findings", count: report.summary.blockerCount },
    ]);

    console.log("\nGrants by capability");
    console.table(report.summary.grantsByCapability);
    console.log("\nGrants by source and scope");
    console.table(report.summary.grantsBySourceAndScope);
    console.log("\nRequired migrations");
    console.table(report.migrationChecks);
    console.log("\nFindings by code");
    console.table(report.findingCounts);
    if (report.findings !== undefined && report.findings.length > 0) {
        console.log("\nDetailed findings (--details)");
        console.table(report.findings);
    }
}

async function main(): Promise<number> {
    const options = parseOptions(process.argv.slice(2));
    const target = parseDatabaseTarget(
        process.env.DATABASE_URL,
        process.env.AUTHORIZATION_PREFLIGHT_ENVIRONMENT,
        process.env.NODE_ENV,
    );
    const evaluation = await runAuthorizationProductionPreflight(
        createAuthorizationProductionReadinessRepository(),
    );
    const report = projectAuthorizationProductionReadinessReport(evaluation, {
        includeDetails: options.details,
    });

    if (options.json) {
        console.log(JSON.stringify({ target, report }, null, 2));
    } else {
        printTerminalReport(target, report);
    }

    return determineAuthorizationProductionReadinessExitCode(report);
}

async function run(): Promise<void> {
    try {
        process.exitCode = await main();
    } catch {
        console.error(
            "Authorization production preflight ทำงานไม่สำเร็จ: ตรวจสอบ DATABASE_URL, NODE_ENV, AUTHORIZATION_PREFLIGHT_ENVIRONMENT และสิทธิ์อ่านฐานข้อมูล",
        );
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

void run();
