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
import { applyRoutineImportBatch } from "@/lib/services/routine-import";
import {
    routineImportApplySchema,
    routineImportBatchIdSchema,
} from "@/lib/validations/routine-import";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ batchId: string }> },
): Promise<NextResponse> {
    const featureResponse = routineFeatureGuard();
    if (featureResponse) return featureResponse;
    const sizeResponse = routineRequestSizeGuard(request);
    if (sizeResponse) return sizeResponse;

    try {
        const auth = await requireAdminSession();
        if (!auth.ok) return auth.response;
        const rateLimitResponse = enforceAuthenticatedMutationRateLimit(
            "routine-import",
            auth.user.id,
        );
        if (rateLimitResponse) return rateLimitResponse;
        const { batchId: rawBatchId } = await params;
        const parsedBatchId = routineImportBatchIdSchema.safeParse(rawBatchId);
        if (!parsedBatchId.success) return NextResponse.json({ error: "รหัสไม่ถูกต้อง" }, { status: 400 });
        const body = await readRoutineJsonBody(request);
        if (!body.ok) return body.response;
        const parsedBody = routineImportApplySchema.safeParse(body.body);
        if (!parsedBody.success) return NextResponse.json({ error: "กรุณายืนยันการนำเข้า" }, { status: 400 });
        const actor = createRoutineCommandActor(
            {
                id: auth.user.id,
                role: auth.user.role ?? "USER",
                email: auth.user.email ?? "",
            },
            request.headers,
        );
        const result = await applyRoutineImportBatch(Number(parsedBatchId.data), actor);
        return NextResponse.json(result);
    } catch (error) {
        return routineErrorResponse(error, "Error applying routine import batch");
    }
}
