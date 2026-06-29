import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/api";
import { jsonError } from "@/lib/ssot/http";
import { saveLocalImageUpload } from "@/lib/uploads/local";

export async function POST(request: Request): Promise<NextResponse> {
    const auth = await requireAdminSession();
    if (!auth.ok) return auth.response;

    const formData = await request.formData();
    const scope = formData.get("scope");
    const file = formData.get("file");

    if (scope !== "item" && scope !== "variant") {
        return jsonError("ประเภทไฟล์อัปโหลดไม่ถูกต้อง", 400);
    }

    if (!(file instanceof File)) {
        return jsonError("กรุณาเลือกไฟล์รูปภาพ", 400);
    }

    try {
        const upload = await saveLocalImageUpload({ scope, file });
        return NextResponse.json({ upload });
    } catch (error) {
        const message = error instanceof Error ? error.message : "อัปโหลดรูปไม่สำเร็จ";
        return jsonError(message, 400);
    }
}
