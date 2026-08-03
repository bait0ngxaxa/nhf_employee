import { type NextRequest, NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth/api";
import { createRoutineCommandActor } from "@/lib/server/routine-command-actor";
import { enforceAuthenticatedMutationRateLimit } from "@/lib/security/mutation-rate-limit";
import {
    readRoutineJsonBody,
    routineErrorResponse,
    routineFeatureGuard,
    routineRequestSizeGuard,
} from "@/lib/server/routine-api";
import { cancelRoutineOccurrence } from "@/lib/services/routine";
import { routineIdParamSchema, routineReasonSchema } from "@/lib/validations/routine";

export async function POST(
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
        const parsed = routineReasonSchema.safeParse(body.body);
        if (!parsed.success) return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง", details: parsed.error.flatten().fieldErrors }, { status: 400 });
        const actor = createRoutineCommandActor({ id: auth.user.id, role: auth.user.role ?? "ADMIN", email: auth.user.email ?? "" }, request.headers);
        const occurrence = await cancelRoutineOccurrence(Number(parsedId.data), parsed.data, actor);
        return NextResponse.json({ occurrence });
    } catch (error) {
        return routineErrorResponse(error, "Error cancelling routine occurrence");
    }
}
