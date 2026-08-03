import { type NextRequest, NextResponse } from "next/server";

import { requireActiveWorkforceOrAdminSession } from "@/lib/auth/workforce";
import { createRoutineCommandActor } from "@/lib/server/routine-command-actor";
import {
    routineErrorResponse,
    routineFeatureGuard,
} from "@/lib/server/routine-api";
import { getRoutineOccurrences } from "@/lib/services/routine";
import { routineOccurrenceFiltersSchema } from "@/lib/validations/routine";

export async function GET(request: NextRequest): Promise<NextResponse> {
    const featureResponse = routineFeatureGuard();
    if (featureResponse) return featureResponse;

    try {
        const auth = await requireActiveWorkforceOrAdminSession();
        if (!auth.ok) return auth.response;
        const params = request.nextUrl.searchParams;
        const parsed = routineOccurrenceFiltersSchema.safeParse({
            status: params.get("status") ?? undefined,
            unitId: params.get("unitId") ?? undefined,
            categoryId: params.get("categoryId") ?? undefined,
            assigneeId: params.get("assigneeId") ?? undefined,
            dueFrom: params.get("dueFrom") ?? undefined,
            dueTo: params.get("dueTo") ?? undefined,
            search: params.get("search") ?? undefined,
            scope: params.get("scope") ?? undefined,
            page: params.get("page") ?? undefined,
            limit: params.get("limit") ?? undefined,
        });
        if (!parsed.success) {
            return NextResponse.json(
                { error: "พารามิเตอร์ไม่ถูกต้อง", details: parsed.error.flatten().fieldErrors },
                { status: 400 },
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
        const result = await getRoutineOccurrences(parsed.data, {
            actor,
            employeeId,
        });
        return NextResponse.json(result);
    } catch (error) {
        return routineErrorResponse(error, "Error fetching routine occurrences");
    }
}
