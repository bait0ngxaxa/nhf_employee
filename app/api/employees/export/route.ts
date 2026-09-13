import { after, type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { logDataExport } from "@/lib/server/audit";
import {
    assertEmployeeCapabilityForMigration,
    assertEmployeeCapabilityScope,
    buildEmployeeAuthorizationContext,
    createEmployeeExport,
    EmployeeCapabilityDeniedError,
    employeeFiltersSchema,
    type EmployeeFilters,
} from "@/modules/employee";
import { forbidden, jsonError } from "@/lib/ssot/http";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";

function parseExportFilters(
    url: string,
): { success: true; data: EmployeeFilters } | { success: false; response: NextResponse } {
    const { searchParams } = new URL(url);
    // Only parse search/status filters — export manages its own batching via EXPORT_LIMITS
    const parsed = employeeFiltersSchema.safeParse({
        search: searchParams.get("search") || undefined,
        status: searchParams.get("status") || undefined,
    });

    if (!parsed.success) {
        return {
            success: false,
            response: jsonError(COMMON_API_MESSAGES.invalidInput, 400, {
                details: parsed.error.flatten().fieldErrors,
            }),
        };
    }

    return { success: true, data: parsed.data };
}

export async function GET(request: NextRequest): Promise<Response> {
    try {
        const auth = await requireApiSession();
        if (!auth.ok) return auth.response;

        const userId = Number(auth.session.user.id);
        if (Number.isNaN(userId)) {
            return NextResponse.json(
                { error: COMMON_API_MESSAGES.invalidUserId },
                { status: 400 },
            );
        }

        const parsedFilters = parseExportFilters(request.url);
        if (!parsedFilters.success) {
            return parsedFilters.response;
        }

        const authorization = await assertEmployeeCapabilityForMigration(
            buildEmployeeAuthorizationContext(auth.user),
            "employee.export",
        );
        assertEmployeeCapabilityScope(authorization, "ALL");

        const filters = parsedFilters.data;
        const exportPreparation = await createEmployeeExport(filters);

        if (exportPreparation.status === "limit-exceeded") {
            return jsonError(
                `ส่งออกข้อมูลพนักงานได้ไม่เกิน ${exportPreparation.maxRows} รายการต่อครั้ง กรุณากรองข้อมูลเพิ่มเติม`,
                400,
                {
                    maxRows: exportPreparation.maxRows,
                    recordCount: exportPreparation.recordCount,
                },
            );
        }

        after(async () => {
            try {
                await logDataExport("Employee", userId, auth.user.email, {
                    metadata: {
                        entityType: "Employee",
                        recordCount: exportPreparation.recordCount,
                        filters: exportPreparation.auditFilters,
                        exportedAt: new Date().toISOString(),
                    },
                });
            } catch (error) {
                console.error("Failed to log employee export audit:", error);
            }
        });

        return exportPreparation.response;
    } catch (error) {
        if (error instanceof EmployeeCapabilityDeniedError) {
            return forbidden();
        }
        console.error("Employee export error:", error);
        return jsonError("ไม่สามารถส่งออกข้อมูลพนักงานได้", 500);
    }
}
