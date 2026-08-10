import { type NextRequest, NextResponse } from "next/server";

import { requireLiffWorkforceSession } from "@/lib/auth/liff";
import { createRoutineCommandActor } from "@/lib/server/routine-command-actor";
import { serializeLiffRoutineTasks } from "@/lib/server/line-routine-api";
import {
    routineErrorResponse,
    routineFeatureGuard,
} from "@/lib/server/routine-api";
import { getRoutineTaskWorkItems } from "@/lib/services/routine";
import { liffRoutineTaskQuerySchema } from "@/lib/validations/line-routine";

export async function GET(request: NextRequest): Promise<NextResponse> {
    const featureResponse = routineFeatureGuard();
    if (featureResponse) return featureResponse;

    try {
        const auth = await requireLiffWorkforceSession();
        if (!auth.ok) return auth.response;

        const params = request.nextUrl.searchParams;
        const parsed = liffRoutineTaskQuerySchema.safeParse({
            timingStatus: params.get("timingStatus") ?? undefined,
            taskId: params.get("taskId") ?? undefined,
            occurrenceId: params.get("occurrenceId") ?? undefined,
            page: params.get("page") ?? undefined,
            limit: params.get("limit") ?? undefined,
        });
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: "พารามิเตอร์ Routine ไม่ถูกต้อง",
                    details: parsed.error.flatten().fieldErrors,
                },
                { status: 400 },
            );
        }

        const actor = createRoutineCommandActor(
            {
                id: auth.user.id,
                role: auth.user.role,
                email: auth.user.email,
            },
            request.headers,
        );

        const result = await getRoutineTaskWorkItems(
            {
                taskId: parsed.data.taskId,
                occurrenceId: parsed.data.occurrenceId,
                timingStatus: parsed.data.timingStatus,
                scope: "mine",
                page: parsed.data.page,
                limit: parsed.data.limit,
            },
            {
                actor,
                employeeId: auth.employeeId,
            },
        );
        return NextResponse.json(serializeLiffRoutineTasks(result));
    } catch (error) {
        return routineErrorResponse(error, "Error fetching LIFF routine tasks");
    }
}
