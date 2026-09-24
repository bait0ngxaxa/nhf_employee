import type { NextResponse } from "next/server";

import { forbidden, jsonError, notFound } from "@/lib/ssot/http";
import {
    ITCapabilityDeniedError,
    ITTicketIdempotencyConflictError,
    ITTicketInputValidationError,
    ITTicketNotFoundError,
    ITWorkforceDeniedError,
} from "@/modules/it";

export function mapITTicketRouteError(error: unknown): NextResponse | null {
    if (error instanceof ITCapabilityDeniedError || error instanceof ITWorkforceDeniedError) {
        return forbidden({ success: false });
    }
    if (error instanceof ITTicketInputValidationError) {
        return jsonError(error.message, 400, { success: false });
    }
    if (error instanceof ITTicketIdempotencyConflictError) {
        return jsonError(error.message, 409, { success: false });
    }
    if (error instanceof ITTicketNotFoundError) {
        return notFound({ success: false });
    }
    return null;
}
