import { after, type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { WorkforceAuthorizationError } from "@/lib/auth/workforce-transaction";
import { getTrustedClientIp } from "@/lib/network/trusted-client-ip";
import { getEmployeeLeaveOffboardingBlockers } from "@/modules/leave";
import { employeeAccountLifecycle } from "@/modules/auth";
import {
    appendEmployeeDeleteAudit,
    appendEmployeeUpdateAudit,
    assertEmployeeCapabilityForMigration,
    assertEmployeeCapabilityScope,
    buildEmployeeAuthorizedCommandActor,
    EmployeeCapabilityDeniedError,
    deleteEmployee,
    updateEmployee,
    updateEmployeeSchema,
} from "@/modules/employee";
import { jsonError } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";

async function parseEmployeeId(
    params: Promise<{ id: string }>,
): Promise<{ employeeId: number | null; error?: NextResponse }> {
    const { id } = await params;
    if (!/^\d+$/.test(id)) {
        return {
            employeeId: null,
            error: jsonError(COMMON_API_MESSAGES.invalidEmployeeId, 400),
        };
    }

    const employeeId = Number(id);

    if (!Number.isSafeInteger(employeeId) || employeeId <= 0) {
        return {
            employeeId: null,
            error: jsonError(COMMON_API_MESSAGES.invalidEmployeeId, 400),
        };
    }

    return { employeeId };
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    try {
        const { employeeId, error } = await parseEmployeeId(params);
        if (error) return error;
        if (!employeeId) {
            return jsonError(COMMON_API_MESSAGES.invalidEmployeeId, 400);
        }

        const body = await request.json();
        const validationResult = updateEmployeeSchema.safeParse(body);
        if (!validationResult.success) {
            const errors = validationResult.error.flatten();
            return jsonError(COMMON_API_MESSAGES.invalidInput, 400, {
                details: errors.fieldErrors,
            });
        }

        const auth = await requireApiSession();
        if (!auth.ok) return auth.response;

        const commandActor = buildEmployeeAuthorizedCommandActor(auth.user);
        const authorization = await assertEmployeeCapabilityForMigration(
            commandActor.authorization,
            "employee.update",
        );
        assertEmployeeCapabilityScope(authorization, "ALL");

        const result = await updateEmployee(
            employeeId,
            validationResult.data,
            commandActor,
            getEmployeeLeaveOffboardingBlockers,
            employeeAccountLifecycle,
        );

        if (!result.success) {
            return jsonError(result.error || COMMON_API_MESSAGES.operationFailed, result.status || 500);
        }

        if (!result.auditRecorded) {
            const auditActor = {
                userId: auth.user.id,
                email: auth.user.email,
                ipAddress: getTrustedClientIp(request.headers),
                userAgent: request.headers.get("user-agent") || null,
            };
            after(async () => {
                await appendEmployeeUpdateAudit({
                    employeeId,
                    actor: auditActor,
                    before: result.beforeData,
                    after: validationResult.data as Record<string, unknown>,
                    employee: result.employee,
                    statusChanged: Boolean(
                        validationResult.data.status
                        && result.beforeData?.status !== validationResult.data.status,
                    ),
                });
            });
        }

        return NextResponse.json(
            {
                message: COMMON_API_MESSAGES.employeeUpdatedSuccessfully,
                employee: result.employee,
            },
            { status: 200 },
        );
    } catch (error) {
        if (
            error instanceof EmployeeCapabilityDeniedError
            || error instanceof WorkforceAuthorizationError
        ) {
            return jsonError(COMMON_API_MESSAGES.forbidden, 403);
        }
        console.error("Error updating employee:", error);
        return jsonError(COMMON_API_MESSAGES.failedToUpdateEmployee, 500);
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    try {
        const auth = await requireApiSession();
        if (!auth.ok) return auth.response;

        const commandActor = buildEmployeeAuthorizedCommandActor(auth.user);
        const authorization = await assertEmployeeCapabilityForMigration(
            commandActor.authorization,
            "employee.delete",
        );
        assertEmployeeCapabilityScope(authorization, "ALL");

        const { employeeId, error } = await parseEmployeeId(params);
        if (error) return error;
        if (!employeeId) {
            return jsonError(COMMON_API_MESSAGES.invalidEmployeeId, 400);
        }

        const result = await deleteEmployee(
            employeeId,
            commandActor,
            getEmployeeLeaveOffboardingBlockers,
            employeeAccountLifecycle,
        );

        if (!result.success) {
            return jsonError(result.error || COMMON_API_MESSAGES.operationFailed, result.status || 500);
        }

        if (!result.auditRecorded) {
            const auditActor = {
                userId: auth.user.id,
                email: auth.user.email,
                ipAddress: getTrustedClientIp(request.headers),
                userAgent: request.headers.get("user-agent") || null,
            };
            after(async () => {
                await appendEmployeeDeleteAudit({
                    employeeId,
                    actor: auditActor,
                    before: result.beforeData,
                });
            });
        }

        return NextResponse.json(
            { message: COMMON_API_MESSAGES.employeeDeletedSuccessfully },
            { status: 200 },
        );
    } catch (error) {
        if (
            error instanceof EmployeeCapabilityDeniedError
            || error instanceof WorkforceAuthorizationError
        ) {
            return jsonError(COMMON_API_MESSAGES.forbidden, 403);
        }
        console.error("Error deleting employee:", error);
        return jsonError(COMMON_API_MESSAGES.failedToDeleteEmployee, 500);
    }
}
