import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth/api";
import { withTrustedMutation } from "@/lib/auth/csrf";
import { contentLengthExceedsLimit, readBoundedJsonBody } from "@/lib/server/request-body";
import { enforceAuthenticatedMutationRateLimit, enforcePreAuthIpRateLimit } from "@/lib/security/mutation-rate-limit";
import { badRequest, forbidden, jsonError, operationFailed } from "@/lib/ssot/http";
import { APP_ROUTES } from "@/lib/ssot/routes";
import { AnnouncementError, getManagedAnnouncement, mutateAnnouncement } from "@/modules/announcements";

const MAX_BODY_BYTES = 8192;

export async function GET(): Promise<NextResponse> {
    try {
        const auth = await requireAdminSession();
        if (!auth.ok) return auth.response;
        return NextResponse.json({ announcement: await getManagedAnnouncement(auth.user) }, {
            headers: { "Cache-Control": "private, no-store" },
        });
    } catch (error) {
        console.error("Error reading managed announcement:", error);
        return operationFailed();
    }
}

export const POST = withTrustedMutation(async (request: NextRequest): Promise<NextResponse> => {
    try {
        const ipLimit = enforcePreAuthIpRateLimit(request, "announcement-update");
        if (ipLimit) return ipLimit;
        if (contentLengthExceedsLimit(request, MAX_BODY_BYTES)) return jsonError("ข้อความมีขนาดใหญ่เกินไป", 413);
        const auth = await requireAdminSession();
        if (!auth.ok) return auth.response;
        const principalLimit = enforceAuthenticatedMutationRateLimit("announcement-update", auth.user.id);
        if (principalLimit) return principalLimit;
        const body = await readBoundedJsonBody(request, MAX_BODY_BYTES);
        if (!body.ok) return body.reason === "TOO_LARGE"
            ? jsonError("ข้อความมีขนาดใหญ่เกินไป", 413) : badRequest();
        const announcement = await mutateAnnouncement(auth.user, body.value);
        revalidatePath(APP_ROUTES.dashboard);
        revalidatePath(APP_ROUTES.dashboardAnnouncements);
        return NextResponse.json({ announcement }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        if (error instanceof AnnouncementError) {
            if (error.code === "FORBIDDEN") return forbidden();
            if (error.code === "INVALID_INPUT") return badRequest({ code: error.code });
            return jsonError("ประกาศถูกแก้ไขแล้ว กรุณาโหลดข้อมูลล่าสุดก่อนบันทึกอีกครั้ง", 409, { code: error.code });
        }
        console.error("Error updating announcement:", error);
        return operationFailed();
    }
});
