import { type NextRequest, NextResponse } from "next/server";

import { requireActiveWorkforceOrAdminSession } from "@/lib/auth/workforce";
import { createRoutineCommandActor } from "@/lib/server/routine-command-actor";
import {
    routineErrorResponse,
    routineFeatureGuard,
} from "@/lib/server/routine-api";
import { getRoutineOccurrenceById } from "@/lib/services/routine";
import { routineIdParamSchema } from "@/lib/validations/routine";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    const featureResponse = routineFeatureGuard();
    if (featureResponse) return featureResponse;

    try {
        const auth = await requireActiveWorkforceOrAdminSession();
        if (!auth.ok) return auth.response;
        const { id: rawId } = await params;
        const parsedId = routineIdParamSchema.safeParse(rawId);
        if (!parsedId.success) return NextResponse.json({ error: "รหัสไม่ถูกต้อง" }, { status: 400 });
        const actor = createRoutineCommandActor(
            {
                id: auth.user.id,
                role: auth.user.role ?? "USER",
                email: auth.user.email ?? "",
            },
            request.headers,
        );
        const employeeId = "employeeId" in auth ? auth.employeeId : null;
        const result = await getRoutineOccurrenceById(Number(parsedId.data), {
            actor,
            employeeId,
        });
        if (!result) return NextResponse.json({ error: "ไม่พบงานประจำ" }, { status: 404 });
        return NextResponse.json(result);
    } catch (error) {
        return routineErrorResponse(error, "Error fetching routine occurrence");
    }
}
