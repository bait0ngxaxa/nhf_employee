import { buildLiffUrl } from "@/lib/line/liff-links";
import { APP_ROUTES } from "@/lib/ssot/routes";
import { leaveRequestIdParamSchema } from "@/modules/leave/schemas/leave";

export type LeaveLiffAction = "approve" | "review" | "cancel" | "not-taken";

export function buildLeaveLiffUrl(): string {
    return buildLiffUrl(APP_ROUTES.line.leave);
}

export function buildLeaveLiffRequestUrl(
    requestId: string,
    options: { action?: LeaveLiffAction } = {},
): string {
    const parsedRequestId = leaveRequestIdParamSchema.safeParse(requestId);
    if (!parsedRequestId.success) {
        throw new Error("Invalid Leave request ID");
    }
    return buildLiffUrl(APP_ROUTES.line.leave, {
        requestId: parsedRequestId.data,
        action: options.action,
    });
}
