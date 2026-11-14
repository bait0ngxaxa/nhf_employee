import { withTrustedMutation } from "@/lib/auth/csrf";
import { type NextRequest, NextResponse } from "next/server";
import { requireActiveWorkforceSession } from "@/lib/auth/workforce";
import {
    enforceAuthenticatedMutationRateLimit,
    enforcePreAuthIpRateLimit,
} from "@/lib/security/mutation-rate-limit";
import {
    contentLengthExceedsLimit,
    readBoundedFormData,
} from "@/lib/server/request-body";
import { forbidden, jsonError, serverError } from "@/lib/ssot/http";
import { IMAGE_UPLOAD_MAX_REQUEST_BYTES } from "@/lib/ssot/uploads";
import {
    ImageUploadValidationError,
    saveLocalImageUpload,
} from "@/lib/uploads/local";
import {
    AuthorizationConfigurationError,
} from "@/modules/authorization";
import {
    assertStockCapability,
    buildStockAuthorizationContext,
    StockCapabilityDeniedError,
} from "@/modules/stock";

const RATE_LIMIT_SCOPE = "stock-image-upload";
const REQUEST_TOO_LARGE_MESSAGE = "คำขอมีขนาดใหญ่เกินไป";
const INVALID_FORM_MESSAGE = "รูปแบบข้อมูลไม่ถูกต้อง";
const UPLOAD_FAILED_MESSAGE = "อัปโหลดรูปไม่สำเร็จ";

type ImageUploadAuthorization =
    | { readonly ok: true; readonly userId: number }
    | { readonly ok: false; readonly response: NextResponse };

async function authorizeImageUpload(): Promise<ImageUploadAuthorization> {
    const auth = await requireActiveWorkforceSession();
    if (!auth.ok) return { ok: false, response: auth.response };

    try {
        await assertStockCapability(
            buildStockAuthorizationContext(
                auth.user,
                "employeeId" in auth ? auth.employeeId : null,
                "DASHBOARD",
            ),
            "stock.inventory.manage",
        );
    } catch (error) {
        if (error instanceof StockCapabilityDeniedError) {
            return { ok: false, response: forbidden() };
        }
        if (error instanceof AuthorizationConfigurationError) {
            console.error("Error authorizing image upload", {
                errorType: error.name,
                code: error.code,
            });
            return { ok: false, response: serverError() };
        }
        throw error;
    }

    return { ok: true, userId: auth.user.id };
}

export const POST = withTrustedMutation(async (request: NextRequest): Promise<NextResponse> => {
    // Fast path only: the body is still read through a bounded stream below.
    if (contentLengthExceedsLimit(request, IMAGE_UPLOAD_MAX_REQUEST_BYTES)) {
        return jsonError(REQUEST_TOO_LARGE_MESSAGE, 413);
    }

    const preAuthLimited = enforcePreAuthIpRateLimit(request, RATE_LIMIT_SCOPE);
    if (preAuthLimited) return preAuthLimited;

    const authorization = await authorizeImageUpload();
    if (!authorization.ok) return authorization.response;

    const limited = enforceAuthenticatedMutationRateLimit(
        RATE_LIMIT_SCOPE,
        authorization.userId,
    );
    if (limited) return limited;

    const bounded = await readBoundedFormData(request, IMAGE_UPLOAD_MAX_REQUEST_BYTES);
    if (!bounded.ok) {
        return bounded.reason === "TOO_LARGE"
            ? jsonError(REQUEST_TOO_LARGE_MESSAGE, 413)
            : jsonError(INVALID_FORM_MESSAGE, 400);
    }

    const scope = bounded.formData.get("scope");
    const file = bounded.formData.get("file");

    if (scope !== "item" && scope !== "variant") {
        return jsonError("ประเภทไฟล์อัปโหลดไม่ถูกต้อง", 400);
    }

    if (!(file instanceof File)) {
        return jsonError("กรุณาเลือกไฟล์รูปภาพ", 400);
    }

    const currentAuthorization = await authorizeImageUpload();
    if (!currentAuthorization.ok) return currentAuthorization.response;

    try {
        const upload = await saveLocalImageUpload({ scope, file });
        return NextResponse.json({ upload });
    } catch (error) {
        if (error instanceof ImageUploadValidationError) {
            return jsonError(error.message, 400);
        }
        // sharp/libvips and filesystem errors may carry internal details or
        // paths; log the error type only and return a generic message.
        console.error("Error saving image upload", {
            errorType: error instanceof Error ? error.name : typeof error,
            scope,
        });
        return jsonError(UPLOAD_FAILED_MESSAGE, 500);
    }
});
