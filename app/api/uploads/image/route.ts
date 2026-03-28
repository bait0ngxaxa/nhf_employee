import { NextResponse } from "next/server";
import { getApiAuthSession } from "@/lib/server-auth";
import { buildUserContext } from "@/lib/context";
import { isAdminRole } from "@/lib/ssot/permissions";
import { forbidden, jsonError, unauthorized } from "@/lib/ssot/http";
import { saveLocalImageUpload } from "@/lib/uploads/local";

export async function POST(request: Request): Promise<NextResponse> {
    const session = await getApiAuthSession();
    if (!session) return unauthorized();

    const user = buildUserContext(session);
    if (!isAdminRole(user.role)) return forbidden();

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
