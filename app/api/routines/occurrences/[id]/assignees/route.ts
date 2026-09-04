import { type NextRequest, NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth/api";
import { createRoutineCommandActor } from "@/modules/routine";
import { enforceAuthenticatedMutationRateLimit } from "@/lib/security/mutation-rate-limit";
import {
    readRoutineJsonBody,
    routineErrorResponse,
    routineFeatureGuard,
    routineRequestSizeGuard,
} from "@/modules/routine";
import {
    getRoutineOccurrenceById,
    reassignRoutineOccurrence,
} from "@/modules/routine";
import {
    routineIdParamSchema,
    routineOccurrenceAssigneesSchema,
} from "@/modules/routine";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    const featureResponse = routineFeatureGuard();
    if (featureResponse) return featureResponse;
    const sizeResponse = routineRequestSizeGuard(request);
    if (sizeResponse) return sizeResponse;
    try {
        const auth = await requireAdminSession();
        if (!auth.ok) return auth.response;
        const rateLimitResponse = enforceAuthenticatedMutationRateLimit("routine-occurrence-admin", auth.user.id);
        if (rateLimitResponse) return rateLimitResponse;
        const { id: rawId } = await params;
        const parsedId = routineIdParamSchema.safeParse(rawId);
        if (!parsedId.success) return NextResponse.json({ error: "รหัสไม่ถูกต้อง" }, { status: 400 });
        const body = await readRoutineJsonBody(request);
        if (!body.ok) return body.response;
        const parsed = routineOccurrenceAssigneesSchema.safeParse(body.body);
        if (!parsed.success) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง", details: parsed.error.flatten().fieldErrors }, { status: 400 });
        const actor = createRoutineCommandActor({ id: auth.user.id, role: auth.user.role ?? "ADMIN", email: auth.user.email ?? "" }, request.headers);
        await reassignRoutineOccurrence(Number(parsedId.data), parsed.data, actor);
        const result = await getRoutineOccurrenceById(Number(parsedId.data), {
            actor,
            employeeId: null,
        });
        if (!result) return NextResponse.json({ error: "ไม่พบรายการ Routine" }, { status: 404 });
        return NextResponse.json({ occurrence: result.occurrence });
    } catch (error) {
        return routineErrorResponse(error, "Error reassigning routine occurrence");
    }
}
