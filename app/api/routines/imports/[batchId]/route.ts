import { type NextRequest, NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth/api";
import {
    routineErrorResponse,
    routineFeatureGuard,
} from "@/modules/routine";
import { getRoutineImportBatch } from "@/modules/routine";
import { routineImportBatchIdSchema } from "@/modules/routine";

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ batchId: string }> },
): Promise<NextResponse> {
    const featureResponse = routineFeatureGuard();
    if (featureResponse) return featureResponse;

    try {
        const auth = await requireAdminSession();
        if (!auth.ok) return auth.response;
        const { batchId: rawBatchId } = await params;
        const parsed = routineImportBatchIdSchema.safeParse(rawBatchId);
        if (!parsed.success) return NextResponse.json({ error: "รหัสไม่ถูกต้อง" }, { status: 400 });
        const batch = await getRoutineImportBatch(Number(parsed.data));
        return NextResponse.json({ batch });
    } catch (error) {
        return routineErrorResponse(error, "Error fetching routine import batch");
    }
}
