import crypto from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db/prisma";
import {
    buildRefreshTokenRecord,
    issueAccessToken,
} from "@/lib/auth/hybrid/tokens";
import {
    employeeAccountLifecycle,
    refreshHybridSession,
    resetPassword,
    resolveAuthenticatedAccount,
    logoutAllRefreshSessions,
    logoutCurrentRefreshSession,
    revokeAuthSessionFamily,
} from "@/modules/auth";
import { getEmployeeLeaveOffboardingBlockers } from "@/modules/leave";
import { updateEmployee } from "@/modules/employee";

const DEPARTMENT_NAME = "L1 Auth Session Concurrency Integration";
const DEPARTMENT_CODE = "L1-AUTH-RACE";
const ACTOR_EMAIL = "l1-auth-race-actor@thainhf.org";
const FIXTURE_PREFIX = "l1-auth-race";

type LifecycleOperation = "INACTIVE" | "SUSPENDED" | "ACTIVE";

interface ScenarioOptions {
    slug: string;
    employeeStatus?: "ACTIVE" | "INACTIVE" | "SUSPENDED";
    employeeDeletedAt?: Date | null;
    userIsActive?: boolean;
    userDeletedAt?: Date | null;
    linkedEmployee?: boolean;
}

interface Scenario {
    slug: string;
    userId: number;
    employeeId: number;
    sourceId: string;
    familyId: string;
    rawRefreshToken: string;
    accessToken: string;
}

interface RefreshState {
    source: {
        id: string;
        familyId: string;
        rotatedFromId: string | null;
        revokedAt: Date | null;
        lastUsedAt: Date | null;
    } | undefined;
    successors: Array<{
        id: string;
        rotatedFromId: string | null;
        revokedAt: Date | null;
        lastUsedAt: Date | null;
    }>;
    activeRows: string[];
    user: {
        isActive: boolean;
        deletedAt: Date | null;
        tokenVersion: number;
        employee: { status: string; deletedAt: Date | null } | null;
    };
}

function assertDedicatedDatabase(): void {
    const rawUrl = process.env.DATABASE_URL;
    if (!rawUrl) throw new Error("ไม่พบ DATABASE_URL สำหรับ integration test");

    const url = new URL(rawUrl);
    const databaseName = decodeURIComponent(url.pathname.slice(1));
    if (url.protocol !== "mysql:" || !/(?:_integration|_test)$/.test(databaseName)) {
        throw new Error("ปฏิเสธการรัน: DATABASE_URL ไม่ใช่ฐาน integration test");
    }
}

function fixtureEmployeeEmail(slug: string): string {
    return `${FIXTURE_PREFIX}-${slug}@thainhf.org`;
}

function fixtureUserEmail(slug: string): string {
    return `${FIXTURE_PREFIX}-${slug}-user@thainhf.org`;
}

function reportCharacterization(label: string, value: Record<string, number>): void {
    if (process.env.L1_CHARACTERIZATION_REPORT !== "1") return;
    process.stdout.write(`[L1-A] ${label} ${JSON.stringify(value)}\n`);
}

async function cleanFixtures(): Promise<void> {
    const fixtureDepartments = await prisma.department.findMany({
        where: { code: { startsWith: DEPARTMENT_CODE } },
        select: { id: true },
    });
    const fixtureEmails = await prisma.employee.findMany({
        where: {
            OR: [
                { email: { startsWith: `${FIXTURE_PREFIX}-` } },
                ...(fixtureDepartments.length > 0
                    ? [{ departmentId: { in: fixtureDepartments.map(({ id }) => id) } }]
                    : []),
            ],
        },
        select: { id: true, email: true },
    });
    const fixtureUsers = await prisma.user.findMany({
        where: {
            OR: [
                { email: { startsWith: `${FIXTURE_PREFIX}-` } },
                { email: ACTOR_EMAIL },
                { employeeId: { in: fixtureEmails.map(({ id }) => id) } },
            ],
        },
        select: { id: true, email: true },
    });
    const userIds = fixtureUsers.map(({ id }) => id);
    const userEmails = fixtureUsers.map(({ email }) => email);

    if (userIds.length > 0 || userEmails.length > 0) {
        await prisma.auditLog.deleteMany({
            where: {
                OR: [
                    ...(userEmails.length > 0 ? [{ userEmail: { in: userEmails } }] : []),
                    ...(userIds.length > 0 ? [{ userId: { in: userIds } }] : []),
                ],
            },
        });
        if (userIds.length > 0) {
            await prisma.authRefreshToken.deleteMany({ where: { userId: { in: userIds } } });
        }
        if (userEmails.length > 0) {
            await prisma.passwordResetToken.deleteMany({ where: { email: { in: userEmails } } });
        }
        if (userIds.length > 0) {
            await prisma.user.deleteMany({ where: { id: { in: userIds } } });
        }
    }
    if (fixtureEmails.length > 0) {
        await prisma.employee.deleteMany({
            where: { id: { in: fixtureEmails.map(({ id }) => id) } },
        });
    }
    if (fixtureDepartments.length > 0) {
        await prisma.department.deleteMany({
            where: { id: { in: fixtureDepartments.map(({ id }) => id) } },
        });
    }
}

async function createScenario(options: ScenarioOptions): Promise<Scenario> {
    const department = await prisma.department.create({
        data: { name: `${DEPARTMENT_NAME} ${options.slug}`, code: `${DEPARTMENT_CODE}-${options.slug}` },
    });
    const employee = await prisma.employee.create({
        data: {
            firstName: "L1",
            lastName: options.slug,
            email: fixtureEmployeeEmail(options.slug),
            position: "Integration Test",
            departmentId: department.id,
            status: options.employeeStatus ?? "ACTIVE",
            deletedAt: options.employeeDeletedAt ?? null,
        },
    });
    const user = await prisma.user.create({
        data: {
            email: fixtureUserEmail(options.slug),
            name: `L1 ${options.slug}`,
            password: "integration-test-password",
            role: "USER",
            ...(options.linkedEmployee === false ? {} : { employeeId: employee.id }),
            isActive: options.userIsActive ?? true,
            deletedAt: options.userDeletedAt ?? null,
        },
    });
    const familyId = `l1-${options.slug}-${crypto.randomUUID().replaceAll("-", "")}`;
    const refreshDraft = buildRefreshTokenRecord({
        userId: user.id,
        familyId,
        userAgent: "l1-auth-concurrency-test",
        ipAddress: "192.0.2.1",
    });
    const source = await prisma.authRefreshToken.create({
        data: refreshDraft.record,
    });
    const accessToken = await issueAccessToken({
        userId: user.id,
        role: user.role,
        sessionId: familyId,
        tokenVersion: user.tokenVersion,
    });

    return {
        slug: options.slug,
        userId: user.id,
        employeeId: employee.id,
        sourceId: source.id,
        familyId,
        rawRefreshToken: refreshDraft.rawToken,
        accessToken,
    };
}

async function readRefreshState(scenario: Scenario): Promise<RefreshState> {
    const [rows, user] = await Promise.all([
        prisma.authRefreshToken.findMany({
            where: { familyId: scenario.familyId },
            orderBy: { createdAt: "asc" },
            select: {
                id: true,
                familyId: true,
                rotatedFromId: true,
                revokedAt: true,
                lastUsedAt: true,
                expiresAt: true,
            },
        }),
        prisma.user.findUniqueOrThrow({
            where: { id: scenario.userId },
            select: {
                isActive: true,
                deletedAt: true,
                tokenVersion: true,
                employee: { select: { status: true, deletedAt: true } },
            },
        }),
    ]);
    const now = new Date();
    return {
        source: rows.find(({ id }) => id === scenario.sourceId),
        successors: rows
            .filter(({ rotatedFromId }) => rotatedFromId === scenario.sourceId)
            .map(({ id, rotatedFromId, revokedAt, lastUsedAt }) => ({
                id,
                rotatedFromId,
                revokedAt,
                lastUsedAt,
            })),
        activeRows: rows
            .filter(({ revokedAt, expiresAt }) => revokedAt === null && expiresAt > now)
            .map(({ id }) => id),
        user,
    };
}

async function createPasswordResetFixture(scenario: Scenario): Promise<string> {
    const rawToken = `l1-reset-${crypto.randomUUID()}`;
    await prisma.passwordResetToken.create({
        data: {
            token: crypto.createHash("sha256").update(rawToken).digest("hex"),
            email: fixtureUserEmail(scenario.slug),
            expiresAt: new Date(Date.now() + 60_000),
        },
    });
    return rawToken;
}

async function createActor(): Promise<void> {
    await prisma.user.create({
        data: {
            email: ACTOR_EMAIL,
            name: "L1 Actor",
            password: "integration-test-password",
            role: "ADMIN",
        },
    });
}

async function runRefresh(scenario: Scenario) {
    return refreshHybridSession({
        rawRefreshToken: scenario.rawRefreshToken,
        metadata: {
            ipAddress: "192.0.2.1",
            userAgent: "l1-auth-concurrency-test",
        },
    });
}

async function runEmployeeLifecycle(
    scenario: Scenario,
    status: LifecycleOperation,
): Promise<unknown> {
    const actor = await prisma.user.findUniqueOrThrow({
        where: { email: ACTOR_EMAIL },
        select: { id: true, email: true },
    });
    return updateEmployee(
        scenario.employeeId,
        { status },
        { userId: actor.id, email: actor.email },
        status === "ACTIVE" ? undefined : getEmployeeLeaveOffboardingBlockers,
        employeeAccountLifecycle,
    );
}

describe.sequential("Auth/session concurrency characterization with real MySQL", () => {
    beforeAll(async () => {
        assertDedicatedDatabase();
        process.env.AUTH_ACCESS_TOKEN_SECRET ??= "l1-auth-concurrency-test-secret";
        await prisma.$connect();
    });

    beforeEach(async () => {
        await cleanFixtures();
        await createActor();
    });

    afterAll(async () => {
        await cleanFixtures();
        await prisma.$disconnect();
    });

    it("characterizes refresh versus refresh source/successor/family state", async () => {
        let familyRevokedAfterConfirmedReuse = 0;
        let familyStillActiveAfterConcurrentCompletion = 0;

        for (let attempt = 0; attempt < 8; attempt += 1) {
            const scenario = await createScenario({ slug: `refresh-${attempt}` });
            const results = await Promise.all([runRefresh(scenario), runRefresh(scenario)]);
            const stateAfterConcurrentCompletion = await readRefreshState(scenario);
            const successful = results.filter((result) => result.status === "success");
            const concurrentResult = results.find(
                (result) => result.status === "unauthorized" && !result.securityEvent,
            );

            expect(successful).toHaveLength(1);
            const successfulRefresh = successful[0];
            if (!successfulRefresh) throw new Error("คาดว่าจะมี refresh success หนึ่งรายการ");
            expect(concurrentResult).toBeDefined();
            expect(stateAfterConcurrentCompletion.source?.revokedAt).not.toBeNull();
            expect(stateAfterConcurrentCompletion.successors).toHaveLength(1);
            expect(stateAfterConcurrentCompletion.activeRows).toHaveLength(1);
            familyStillActiveAfterConcurrentCompletion += 1;

            const resolved = await resolveAuthenticatedAccount(
                successfulRefresh.accessToken,
            );
            expect(resolved).not.toBeNull();

            const confirmedReuse = await runRefresh(scenario);
            const finalState = await readRefreshState(scenario);
            expect(confirmedReuse.status).toBe("unauthorized");
            if (confirmedReuse.status === "unauthorized") {
                expect(confirmedReuse.securityEvent?.reason).toBe(
                    "refresh_token_reuse_or_expired",
                );
            }
            expect(finalState.activeRows).toHaveLength(0);
            await expect(resolveAuthenticatedAccount(successfulRefresh.accessToken))
                .resolves.toBeNull();
            familyRevokedAfterConfirmedReuse += 1;
        }

        reportCharacterization("refresh-refresh", {
            runs: familyRevokedAfterConfirmedReuse,
            familyStillActiveAfterConcurrentCompletion,
            familyRevokedAfterConfirmedReuse,
        });
        expect(familyRevokedAfterConfirmedReuse).toBe(8);
    });

    it("characterizes refresh versus logout-current in both commit orders", async () => {
        const beforeRefresh = await createScenario({ slug: "logout-current-before" });
        await logoutCurrentRefreshSession(beforeRefresh.rawRefreshToken);
        await runRefresh(beforeRefresh);
        const beforeState = await readRefreshState(beforeRefresh);
        expect(beforeState.activeRows).toHaveLength(0);

        const afterRefresh = await createScenario({ slug: "logout-current-after" });
        const refreshResult = await runRefresh(afterRefresh);
        expect(refreshResult.status).toBe("success");
        if (refreshResult.status !== "success") {
            throw new Error("คาดว่า refresh ก่อน logout-current จะสำเร็จ");
        }
        await logoutCurrentRefreshSession(afterRefresh.rawRefreshToken);
        const afterState = await readRefreshState(afterRefresh);

        reportCharacterization("refresh-logout-current", {
            terminationBeforeRefreshActiveRows: beforeState.activeRows.length,
            refreshBeforeTerminationActiveRows: afterState.activeRows.length,
            refreshBeforeTerminationSuccess: refreshResult.status === "success" ? 1 : 0,
        });
        expect(afterState.successors).toHaveLength(1);
        expect(afterState.source?.revokedAt).not.toBeNull();
        expect(afterState.successors[0]?.revokedAt).not.toBeNull();
        expect(afterState.activeRows).toHaveLength(0);
        await expect(resolveAuthenticatedAccount(refreshResult.accessToken))
            .resolves.toBeNull();
    });

    it("characterizes refresh versus logout-all under concurrent MySQL scheduling", async () => {
        let contained = 0;
        let escaped = 0;
        let refreshSuccess = 0;

        for (let attempt = 0; attempt < 8; attempt += 1) {
            const scenario = await createScenario({ slug: `logout-all-${attempt}` });
            const [refreshResult] = await Promise.all([
                runRefresh(scenario),
                logoutAllRefreshSessions(scenario.userId),
            ]);
            const state = await readRefreshState(scenario);
            if (refreshResult.status === "success") refreshSuccess += 1;
            if (state.activeRows.length === 0) contained += 1;
            else escaped += 1;
            expect(state.activeRows).toHaveLength(0);
            if (refreshResult.status === "success") {
                await expect(resolveAuthenticatedAccount(refreshResult.accessToken))
                    .resolves.toBeNull();
            }
        }

        reportCharacterization("refresh-logout-all", {
            runs: contained + escaped,
            refreshSuccess,
            contained,
            escaped,
        });
        expect(contained + escaped).toBe(8);
    });

    it("characterizes refresh versus per-session family revoke", async () => {
        let contained = 0;
        let escaped = 0;
        let refreshSuccess = 0;
        let revokeSuccess = 0;

        for (let attempt = 0; attempt < 8; attempt += 1) {
            const scenario = await createScenario({ slug: `session-revoke-${attempt}` });
            const [refreshResult, revokeResult] = await Promise.all([
                runRefresh(scenario),
                revokeAuthSessionFamily({
                    userId: scenario.userId,
                    sessionId: scenario.sourceId,
                }),
            ]);
            const state = await readRefreshState(scenario);
            if (refreshResult.status === "success") refreshSuccess += 1;
            if (revokeResult) revokeSuccess += 1;
            if (state.activeRows.length === 0) contained += 1;
            else escaped += 1;
            expect(state.activeRows).toHaveLength(0);
            if (refreshResult.status === "success") {
                await expect(resolveAuthenticatedAccount(refreshResult.accessToken))
                    .resolves.toBeNull();
            }
        }

        reportCharacterization("refresh-session-revoke", {
            runs: contained + escaped,
            refreshSuccess,
            revokeSuccess,
            contained,
            escaped,
        });
        expect(contained + escaped).toBe(8);
    });

    it("does not allow another user to revoke a session family", async () => {
        const scenario = await createScenario({ slug: "cross-user-revoke" });
        const actor = await prisma.user.findUniqueOrThrow({
            where: { email: ACTOR_EMAIL },
            select: { id: true },
        });

        const result = await revokeAuthSessionFamily({
            userId: actor.id,
            sessionId: scenario.sourceId,
        });
        const state = await readRefreshState(scenario);

        expect(result).toBeNull();
        expect(state.activeRows).toHaveLength(1);
        expect(state.source?.revokedAt).toBeNull();
    });

    it("characterizes refresh versus password reset and token-version invalidation", async () => {
        const scenario = await createScenario({ slug: "password-reset" });
        const resetToken = await createPasswordResetFixture(scenario);
        const [refreshResult, resetResult] = await Promise.all([
            runRefresh(scenario),
            resetPassword(resetToken, "L1ResetPassword1"),
        ]);
        const state = await readRefreshState(scenario);

        reportCharacterization("refresh-password-reset", {
            refreshSuccess: refreshResult.status === "success" ? 1 : 0,
            resetSuccess: resetResult.status === "success" ? 1 : 0,
            tokenVersion: state.user.tokenVersion,
            activeRows: state.activeRows.length,
        });
        expect(resetResult.status).toBe("success");
        expect(state.user.tokenVersion).toBe(2);
        expect(state.activeRows).toHaveLength(0);
        if (refreshResult.status === "success") {
            await expect(resolveAuthenticatedAccount(refreshResult.accessToken))
                .resolves.toBeNull();
        }
    });

    it("aligns refresh eligibility with protected resolution without breaking unlinked accounts", async () => {
        const deletedAccount = await createScenario({
            slug: "deleted-account",
            userDeletedAt: new Date(),
        });
        const suspendedEmployee = await createScenario({
            slug: "suspended-account",
            employeeStatus: "SUSPENDED",
        });
        const unlinkedAccount = await createScenario({
            slug: "unlinked-account",
            linkedEmployee: false,
        });

        const [deletedResult, suspendedResult, unlinkedResult] = await Promise.all([
            runRefresh(deletedAccount),
            runRefresh(suspendedEmployee),
            runRefresh(unlinkedAccount),
        ]);
        const [deletedState, suspendedState, unlinkedState] = await Promise.all([
            readRefreshState(deletedAccount),
            readRefreshState(suspendedEmployee),
            readRefreshState(unlinkedAccount),
        ]);

        expect(deletedResult.status).toBe("unauthorized");
        expect(suspendedResult.status).toBe("unauthorized");
        expect(unlinkedResult.status).toBe("success");
        expect(deletedState.activeRows).toHaveLength(0);
        expect(suspendedState.activeRows).toHaveLength(0);
        expect(unlinkedState.activeRows).toHaveLength(1);
        if (unlinkedResult.status === "success") {
            await expect(resolveAuthenticatedAccount(unlinkedResult.accessToken))
                .resolves.not.toBeNull();
        }
    });

    it.each([
        ["OFFBOARD", "offboard", "ACTIVE", true, null],
        ["SUSPEND", "suspend", "ACTIVE", true, null],
        ["REACTIVATE", "reactivate", "SUSPENDED", false, null],
    ] as const)(
        "characterizes refresh versus Employee %s lifecycle invalidation",
        async (operation, slug, employeeStatus, userIsActive, employeeDeletedAt) => {
            const scenario = await createScenario({
                slug,
                employeeStatus,
                userIsActive,
                employeeDeletedAt,
            });
            const [refreshResult, lifecycleResult] = await Promise.all([
                runRefresh(scenario),
                runEmployeeLifecycle(
                    scenario,
                    operation === "OFFBOARD"
                        ? "INACTIVE"
                        : operation === "SUSPEND" ? "SUSPENDED" : "ACTIVE",
                ),
            ]);
            const state = await readRefreshState(scenario);

            reportCharacterization(`refresh-employee-${operation.toLowerCase()}`, {
                refreshSuccess: refreshResult.status === "success" ? 1 : 0,
                lifecycleSuccess: typeof lifecycleResult === "object"
                    && lifecycleResult !== null
                    && "success" in lifecycleResult
                    && lifecycleResult.success === true ? 1 : 0,
                tokenVersion: state.user.tokenVersion,
                activeRows: state.activeRows.length,
            });
            expect(state.activeRows).toHaveLength(0);
            expect(state.user.tokenVersion).toBe(2);
            expect(state.user.isActive).toBe(operation === "REACTIVATE");
            expect(state.user.employee?.status).toBe(
                operation === "OFFBOARD"
                    ? "INACTIVE"
                    : operation === "SUSPEND" ? "SUSPENDED" : "ACTIVE",
            );
            if (refreshResult.status === "success") {
                await expect(resolveAuthenticatedAccount(refreshResult.accessToken))
                    .resolves.toBeNull();
            }
        },
    );
});
