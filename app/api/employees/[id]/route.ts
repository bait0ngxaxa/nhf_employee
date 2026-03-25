import { after, type NextRequest, NextResponse } from "next/server";

import { buildUserContext } from "@/lib/context";
import { logEmployeeEvent } from "@/lib/audit";
import { employeeService } from "@/lib/services/employee";
import { getApiAuthSession } from "@/lib/server-auth";
import { forbidden, jsonError, unauthorized } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import { isAdminRole } from "@/lib/ssot/permissions";
import { updateEmployeeSchema } from "@/lib/validations/employee";

async function parseEmployeeId(
    params: Promise<{ id: string }>,
): Promise<{ employeeId: number | null; error?: NextResponse }> {
    const { id } = await params;
    const employeeId = parseInt(id, 10);

    if (Number.isNaN(employeeId)) {
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

        const session = await getApiAuthSession();
        if (!session) {
            return unauthorized();
        }

        if (!isAdminRole(session.user?.role)) {
            return forbidden();
        }

        const user = buildUserContext(session);
        const result = await employeeService.updateEmployee(employeeId, validationResult.data);

        if (!result.success) {
            return jsonError(result.error || COMMON_API_MESSAGES.operationFailed, result.status || 500);
        }

        const actionType =
            validationResult.data.status && result.beforeData?.status !== validationResult.data.status
                ? ("EMPLOYEE_STATUS_CHANGE" as const)
                : ("EMPLOYEE_UPDATE" as const);

        after(async () => {
            await logEmployeeEvent(actionType, employeeId, user.id, user.email, {
                before: result.beforeData,
                after: validationResult.data as Record<string, unknown>,
            });
        });

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
        const session = await getApiAuthSession();
        if (!session) {
            return unauthorized();
        }

        if (!isAdminRole(session.user?.role)) {
            return forbidden();
        }

        const { employeeId, error } = await parseEmployeeId(params);
        if (error) return error;
        if (!employeeId) {
            return jsonError(COMMON_API_MESSAGES.invalidEmployeeId, 400);
        }

        const user = buildUserContext(session);
        const result = await employeeService.deleteEmployee(employeeId);

        if (!result.success) {
            return jsonError(result.error || COMMON_API_MESSAGES.operationFailed, result.status || 500);
        }

        after(async () => {
            await logEmployeeEvent("EMPLOYEE_DELETE", employeeId, user.id, user.email, {
                before: result.beforeData,
            });
        });

        return NextResponse.json(
            { message: COMMON_API_MESSAGES.employeeDeletedSuccessfully },
            { status: 200 },
        );
    } catch (error) {
        console.error("Error deleting employee:", error);
        return jsonError(COMMON_API_MESSAGES.failedToDeleteEmployee, 500);
    }
}
