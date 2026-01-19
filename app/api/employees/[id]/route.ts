import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateEmployeeSchema } from "@/lib/validations/employee";
import { logEmployeeEvent } from "@/lib/audit";
import { employeeService } from "@/lib/services/employee";
import { buildUserContext } from "@/lib/context";

/**
 * Parse and validate employee ID from params
 */
async function parseEmployeeId(
    params: Promise<{ id: string }>,
): Promise<{ employeeId: number | null; error?: NextResponse }> {
    const { id } = await params;
    const employeeId = parseInt(id);

    if (isNaN(employeeId)) {
        return {
            employeeId: null,
            error: NextResponse.json(
                { error: "Invalid employee ID" },
                { status: 400 },
            ),
        };
    }

    return { employeeId };
}

// PATCH - อัปเดตข้อมูลพนักงาน
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    try {
        const session = await getServerSession(authOptions);

        if (!session || session.user?.role !== "ADMIN") {
            return NextResponse.json(
                { error: "ไม่มีสิทธิ์เข้าถึง" },
                { status: 403 },
            );
        }

        const { employeeId, error } = await parseEmployeeId(params);
        if (error) return error;
        if (!employeeId) {
            return NextResponse.json(
                { error: "Invalid employee ID" },
                { status: 400 },
            );
        }

        const body = await request.json();

        // Validate with Zod
        const validationResult = updateEmployeeSchema.safeParse(body);
        if (!validationResult.success) {
            const errors = validationResult.error.flatten();
            return NextResponse.json(
                { error: "ข้อมูลไม่ถูกต้อง", details: errors.fieldErrors },
                { status: 400 },
            );
        }

        const user = buildUserContext(session);
        const result = await employeeService.updateEmployee(
            employeeId,
            validationResult.data,
        );

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: result.status || 500 },
            );
        }

        // Determine action type based on what changed
        const actionType =
            validationResult.data.status &&
            result.beforeData?.status !== validationResult.data.status
                ? ("EMPLOYEE_STATUS_CHANGE" as const)
                : ("EMPLOYEE_UPDATE" as const);

        // Log audit event
        await logEmployeeEvent(actionType, employeeId, user.id, user.email, {
            before: result.beforeData,
            after: validationResult.data as Record<string, unknown>,
        });

        return NextResponse.json(
            {
                message: "อัปเดตข้อมูลพนักงานสำเร็จ",
                employee: result.employee,
            },
            { status: 200 },
        );
    } catch (error) {
        console.error("Error updating employee:", error);
        return NextResponse.json(
            { error: "เกิดข้อผิดพลาดในการอัปเดต" },
            { status: 500 },
        );
    }
}

// DELETE - ลบพนักงาน
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    try {
        const session = await getServerSession(authOptions);

        if (!session || session.user?.role !== "ADMIN") {
            return NextResponse.json(
                { error: "ไม่มีสิทธิ์เข้าถึง" },
                { status: 403 },
            );
        }

        const { employeeId, error } = await parseEmployeeId(params);
        if (error) return error;
        if (!employeeId) {
            return NextResponse.json(
                { error: "Invalid employee ID" },
                { status: 400 },
            );
        }

        const user = buildUserContext(session);
        const result = await employeeService.deleteEmployee(employeeId);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: result.status || 500 },
            );
        }

        // Log audit event
        await logEmployeeEvent(
            "EMPLOYEE_DELETE",
            employeeId,
            user.id,
            user.email,
            {
                before: result.beforeData,
            },
        );

        return NextResponse.json(
            { message: "ลบพนักงานสำเร็จ" },
            { status: 200 },
        );
    } catch (error) {
        console.error("Error deleting employee:", error);
        return NextResponse.json(
            { error: "เกิดข้อผิดพลาดในการลบ" },
            { status: 500 },
        );
    }
}
