import type { NextResponse } from "next/server";

import { forbidden, jsonError, notFound } from "@/lib/ssot/http";
import { IT_TICKET_DATABASE_INT_MAX } from "@/modules/it";
import {
    ITCapabilityDeniedError,
    ITTicketAssigneeNotEligibleError,
    ITTicketCategoryInactiveError,
    ITTicketCategoryNotFoundError,
    ITTicketInputValidationError,
    ITTicketInvalidTransitionError,
    ITTicketMutationConflictError,
    ITTicketNotFoundError,
    ITWorkforceDeniedError,
} from "@/modules/it";

export function parseITOperatorTicketId(value: string): number | null {
    if (!/^[1-9]\d*$/.test(value)) return null;
    const ticketId = Number(value);
    return Number.isSafeInteger(ticketId) && ticketId <= IT_TICKET_DATABASE_INT_MAX
        ? ticketId
        : null;
}

export function mapITOperatorRouteError(error: unknown): NextResponse | null {
    if (error instanceof ITCapabilityDeniedError || error instanceof ITWorkforceDeniedError) {
        return forbidden({ success: false });
    }
    if (error instanceof ITTicketInputValidationError) {
        return jsonError(error.message, 400, { success: false });
    }
    if (error instanceof ITTicketNotFoundError || error instanceof ITTicketCategoryNotFoundError) {
        return notFound({ success: false });
    }
    if (error instanceof ITTicketMutationConflictError) {
        return jsonError(error.message, 409, {
            success: false,
            code: error.code,
            reason: error.reason,
        });
    }
    if (
        error instanceof ITTicketAssigneeNotEligibleError
        || error instanceof ITTicketCategoryInactiveError
        || error instanceof ITTicketInvalidTransitionError
    ) {
        return jsonError(error.message, 409, { success: false, code: error.code });
    }
    return null;
}
