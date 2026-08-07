import { type NextRequest, NextResponse } from "next/server";

import { requireActiveWorkforceOrAdminSession } from "@/lib/auth/workforce";
import { createRoutineCommandActor } from "@/lib/server/routine-command-actor";
import {
    routineErrorResponse,
    routineFeatureGuard,
} from "@/lib/server/routine-api";
import { getRoutineSummary } from "@/lib/services/routine";
import { routineSummaryQuerySchema } from "@/lib/validations/routine";

export async function GET(request: NextRequest): Promise<NextResponse> {
    const featureResponse = routineFeatureGuard();
    if (featureResponse) return featureResponse;

    try {
        const auth = await requireActiveWorkforceOrAdminSession();
        if (!auth.ok) return auth.response;
        const parsed = routineSummaryQuerySchema.safeParse({
            scope: request.nextUrl.searchParams.get("scope") ?? undefined,
        });
        if (!parsed.success) {
            return NextResponse.json(
                { error: "พารามิเตอร์ไม่ถูกต้อง", details: parsed.error.flatten().fieldErrors },
                { status: 400 },
            );
        }
        if (parsed.data.scope === "all" && auth.user.role !== "ADMIN") {
            return NextResponse.json(
                { error: "คุณไม่มีสิทธิ์ดูสรุป Routine ทั้งหมด" },
                { status: 403 },
            );
        }
        const actor = createRoutineCommandActor(
            {
                id: auth.user.id,
                role: auth.user.role ?? "USER",
                email: auth.user.email ?? "",
            },
            request.headers,
        );
        const employeeId = "employeeId" in auth ? auth.employeeId : null;
        const summary = await getRoutineSummary({
            actor,
            employeeId,
            scope: parsed.data.scope,
        });
        return NextResponse.json({ summary });
    } catch (error) {
        return routineErrorResponse(error, "Error fetching routine summary");
    }
}
