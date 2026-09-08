import { after, type NextRequest } from "next/server";

import { requireActiveWorkforceOrAdminSession } from "@/lib/auth/workforce";
import { logDataExport } from "@/lib/server/audit";
import { jsonError } from "@/lib/ssot/http";
import {
    createRoutineCommandActor,
    prepareRoutineTaskExport,
    routineErrorResponse,
    routineFeatureGuard,
} from "@/modules/routine";

export async function GET(request: NextRequest): Promise<Response> {
    const featureResponse = routineFeatureGuard();
    if (featureResponse) return featureResponse;

    try {
        const auth = await requireActiveWorkforceOrAdminSession();
        if (!auth.ok) return auth.response;

        if (request.nextUrl.searchParams.get("format") !== "xlsx") {
            return jsonError("รูปแบบไฟล์รายงานไม่ถูกต้อง", 400);
        }

        const actor = createRoutineCommandActor(
            {
                id: auth.user.id,
                role: auth.user.role ?? "USER",
                email: auth.user.email ?? "",
            },
            request.headers,
        );
        const exportPreparation = await prepareRoutineTaskExport({
            actor,
            employeeId: "employeeId" in auth ? auth.employeeId : null,
        });
        if (exportPreparation.status === "limit-exceeded") {
            return jsonError(
                `ส่งออกงานประจำได้ไม่เกิน ${exportPreparation.maxRows} รายการต่อครั้ง ขณะนี้มี ${exportPreparation.recordCount} รายการ`,
                400,
                {
                    maxRows: exportPreparation.maxRows,
                    recordCount: exportPreparation.recordCount,
                },
            );
        }

        after(async () => {
            try {
                await logDataExport("RoutineTask", auth.user.id, auth.user.email ?? "", {
                    metadata: {
                        entityType: "RoutineTask",
                        recordCount: exportPreparation.recordCount,
                        filters: {
                            scope: "all",
                            format: "xlsx",
                        },
                        exportedAt: new Date().toISOString(),
                    },
                });
            } catch (error) {
                console.error("Failed to log Routine export audit:", error);
            }
        });

        return exportPreparation.response;
    } catch (error) {
        return routineErrorResponse(error, "Error exporting routine tasks");
    }
}
