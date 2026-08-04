import { type NextRequest, NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth/api";
import {
    routineErrorResponse,
    routineFeatureGuard,
} from "@/lib/server/routine-api";
import { getRoutineImportRows } from "@/lib/services/routine-import";
import {
    routineImportBatchIdSchema,
    routineImportRowsQuerySchema,
} from "@/lib/validations/routine-import";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ batchId: string }> },
): Promise<NextResponse> {
    const featureResponse = routineFeatureGuard();
    if (featureResponse) return featureResponse;

    try {
        const auth = await requireAdminSession();
        if (!auth.ok) return auth.response;
        const { batchId: rawBatchId } = await params;
        const parsedBatchId = routineImportBatchIdSchema.safeParse(rawBatchId);
        if (!parsedBatchId.success) return NextResponse.json({ error: "รหัสไม่ถูกต้อง" }, { status: 400 });
        const query = Object.fromEntries(request.nextUrl.searchParams.entries());
        const parsedQuery = routineImportRowsQuerySchema.safeParse(query);
        if (!parsedQuery.success) {
            return NextResponse.json({ error: "พารามิเตอร์ไม่ถูกต้อง" }, { status: 400 });
        }
        return NextResponse.json({
            ...(await getRoutineImportRows(Number(parsedBatchId.data), parsedQuery.data)),
        });
    } catch (error) {
        return routineErrorResponse(error, "Error fetching routine import rows");
    }
}
