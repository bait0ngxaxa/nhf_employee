import { NextResponse, after, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { requireApiSession } from "@/lib/auth/api";
import { contentLengthExceedsLimit, readBoundedJsonBody } from "@/lib/server/request-body";
import { forbidden, jsonError, operationFailed, unauthorized } from "@/lib/ssot/http";
import { processOutbox } from "@/lib/services/outbox/processor";
import { enforcePreAuthIpRateLimit, enforceAuthenticatedMutationRateLimit } from "@/lib/security/mutation-rate-limit";
import { updateEmailRequestAccessRequirements, EmailRequestAccessConflictError, EmailRequestCapabilityDeniedError, EmailRequestNotFoundError } from "@/modules/it";

const MAX_BODY_BYTES = 4096;

export async function PATCH(
    req: NextRequest,
    context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    try {
        const preAuthLimit = enforcePreAuthIpRateLimit(req, "email-request-access-update");
        if (preAuthLimit) return preAuthLimit;
        if (contentLengthExceedsLimit(req, MAX_BODY_BYTES)) return jsonError("ข้อมูลมีขนาดใหญ่เกินไป", 413);
        const auth = await requireApiSession({ unauthorizedResponse: () => unauthorized({ success: false }) });
        if (!auth.ok) return auth.response;
        const principalLimit = enforceAuthenticatedMutationRateLimit("email-request-access-update", auth.user.id);
        if (principalLimit) return principalLimit;
        const { id: rawId } = await context.params;
        if (!/^[1-9]\d*$/.test(rawId) || Number(rawId) > 2_147_483_647) return jsonError("รหัสคำร้องไม่ถูกต้อง", 400);
        const body = await readBoundedJsonBody(req, MAX_BODY_BYTES);
        if (!body.ok) return jsonError("ข้อมูลคำร้องไม่ถูกต้อง", body.reason === "TOO_LARGE" ? 413 : 400);
        const result = await updateEmailRequestAccessRequirements(Number(rawId), body.value, auth.user);
        if (result.changed) after(async () => {
            await processOutbox().catch((error: unknown) => console.error("Email Request access outbox failed:", error));
        });
        return NextResponse.json({ success: true, changed: result.changed, data: result.emailRequest });
    } catch (error) {
        if (error instanceof EmailRequestCapabilityDeniedError) return forbidden({ success: false });
        if (error instanceof EmailRequestAccessConflictError) return jsonError(error.message, 409, { success: false });
        if (error instanceof EmailRequestNotFoundError) return jsonError(error.message, 404, { success: false });
        if (error instanceof ZodError) return jsonError(error.issues.map((issue) => issue.message).join(", "), 400, { success: false });
        console.error("Error updating Email Request access requirements:", error);
        return operationFailed(500, { success: false });
    }
}
