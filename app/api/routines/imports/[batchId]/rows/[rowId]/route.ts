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
import { updateRoutineImportRow } from "@/modules/routine";
import {
    routineImportBatchIdSchema,
    routineImportRowUpdateSchema,
} from "@/modules/routine";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ batchId: string; rowId: string }> },
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
        const { batchId: rawBatchId, rowId: rawRowId } = await params;
        const parsedBatchId = routineImportBatchIdSchema.safeParse(rawBatchId);
        const parsedRowId = routineImportBatchIdSchema.safeParse(rawRowId);
        if (!parsedBatchId.success || !parsedRowId.success) {
            return NextResponse.json({ error: "รหัสไม่ถูกต้อง" }, { status: 400 });
        }
        const body = await readRoutineJsonBody(request);
        if (!body.ok) return body.response;
        const parsed = routineImportRowUpdateSchema.safeParse(body.body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "ข้อมูลแถวไม่ถูกต้อง", details: parsed.error.flatten().fieldErrors },
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
        const row = await updateRoutineImportRow(
            Number(parsedBatchId.data),
            Number(parsedRowId.data),
            parsed.data,
            actor,
        );
        return NextResponse.json({ row });
    } catch (error) {
        return routineErrorResponse(error, "Error updating routine import row");
    }
}
