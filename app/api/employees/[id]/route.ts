import { after, type NextRequest, NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth/api";
import { logEmployeeEvent } from "@/lib/server/audit";
import { employeeService } from "@/lib/services/employee";
import { getEmployeeDisplayName } from "@/lib/helpers/employee-helpers";
import { jsonError } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import { updateEmployeeSchema } from "@/lib/validations/employee";

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

        const auth = await requireAdminSession();
        if (!auth.ok) return auth.response;

        const result = await employeeService.updateEmployee(
            employeeId,
            validationResult.data,
            { userId: auth.user.id, email: auth.user.email },
        );

        if (!result.success) {
            return jsonError(result.error || COMMON_API_MESSAGES.operationFailed, result.status || 500);
        }

        const actionType =
            validationResult.data.status && result.beforeData?.status !== validationResult.data.status
                ? ("EMPLOYEE_STATUS_CHANGE" as const)
                : ("EMPLOYEE_UPDATE" as const);

        if (!result.auditRecorded) {
            after(async () => {
                await logEmployeeEvent(actionType, employeeId, auth.user.id, auth.user.email, {
                    before: result.beforeData,
                    after: validationResult.data as Record<string, unknown>,
                    metadata: result.employee
                        ? { employeeName: getEmployeeDisplayName(result.employee) }
                        : undefined,
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
        console.error("Error updating employee:", error);
        return jsonError(COMMON_API_MESSAGES.failedToUpdateEmployee, 500);
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    try {
        const auth = await requireAdminSession();
        if (!auth.ok) return auth.response;

        const { employeeId, error } = await parseEmployeeId(params);
        if (error) return error;
        if (!employeeId) {
            return jsonError(COMMON_API_MESSAGES.invalidEmployeeId, 400);
        }

        const result = await employeeService.deleteEmployee(
            employeeId,
            { userId: auth.user.id, email: auth.user.email },
        );

        if (!result.success) {
            return jsonError(result.error || COMMON_API_MESSAGES.operationFailed, result.status || 500);
        }

        if (!result.auditRecorded) {
            after(async () => {
                await logEmployeeEvent("EMPLOYEE_DELETE", employeeId, auth.user.id, auth.user.email, {
                    before: result.beforeData,
                });
            });
        }

        return NextResponse.json(
            { message: COMMON_API_MESSAGES.employeeDeletedSuccessfully },
            { status: 200 },
        );
    } catch (error) {
        console.error("Error deleting employee:", error);
        return jsonError(COMMON_API_MESSAGES.failedToDeleteEmployee, 500);
    }
}
