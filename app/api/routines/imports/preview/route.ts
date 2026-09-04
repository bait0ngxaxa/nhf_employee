import { type NextRequest, NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth/api";
import { createRoutineCommandActor } from "@/modules/routine";
import {
    routineErrorResponse,
    routineFeatureGuard,
} from "@/modules/routine";
import { enforceAuthenticatedMutationRateLimit } from "@/lib/security/mutation-rate-limit";
import { createRoutineImportPreview } from "@/modules/routine";
import { ROUTINE_IMPORT_MAX_FILE_BYTES } from "@/modules/routine";
import { routineImportPreviewOptionsSchema } from "@/modules/routine";

function isUploadFile(value: FormDataEntryValue | null): value is File {
    return typeof value === "object"
        && value !== null
        && "name" in value
        && typeof value.name === "string"
        && "size" in value
        && typeof value.size === "number"
        && "arrayBuffer" in value
        && typeof value.arrayBuffer === "function";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    const featureResponse = routineFeatureGuard();
    if (featureResponse) return featureResponse;

    const contentLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > ROUTINE_IMPORT_MAX_FILE_BYTES + 64 * 1024) {
        return NextResponse.json({ error: "ไฟล์มีขนาดเกิน 10 MB" }, { status: 413 });
    }

    try {
        const auth = await requireAdminSession();
        if (!auth.ok) return auth.response;
        const rateLimitResponse = enforceAuthenticatedMutationRateLimit(
            "routine-import",
            auth.user.id,
        );
        if (rateLimitResponse) return rateLimitResponse;

        const formData = await request.formData();
        const fileValue = formData.get("file");
        if (!isUploadFile(fileValue)) {
            return NextResponse.json({ error: "กรุณาเลือกไฟล์ Excel" }, { status: 400 });
        }
        const asOfValue = formData.get("asOfDate");
        const options = routineImportPreviewOptionsSchema.safeParse({
            asOfDate: typeof asOfValue === "string" ? asOfValue : undefined,
        });
        if (!options.success) {
            return NextResponse.json({ error: "วันที่อ้างอิงไม่ถูกต้อง" }, { status: 400 });
        }
        const actor = createRoutineCommandActor(
            {
                id: auth.user.id,
                role: auth.user.role ?? "USER",
                email: auth.user.email ?? "",
            },
            request.headers,
        );
        const result = await createRoutineImportPreview(
            fileValue,
            actor,
            options.data.asOfDate,
        );
        return NextResponse.json(result, { status: result.reusedExisting ? 200 : 201 });
    } catch (error) {
        return routineErrorResponse(error, "Error creating routine import preview");
    }
}
