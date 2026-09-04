import { after, type NextRequest, type NextResponse } from "next/server";

import { requireActiveWorkforceSession } from "@/lib/auth/workforce";
import {
    enforceLeaveJsonBodySize,
    handleLeaveNotTakenConfirmation,
    handleLeaveNotTakenRequest,
} from "@/modules/leave";
import { processOutbox } from "@/lib/services/outbox/processor";
import {
    enforceAuthenticatedMutationRateLimit,
    enforcePreAuthIpRateLimit,
} from "@/lib/security/mutation-rate-limit";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { notFound } from "@/lib/ssot/http";

function scheduleLeaveOutbox(): void {
    after(() => {
        processOutbox().catch((error: unknown) =>
            console.error("Failed to process leave not-taken outbox:", error),
        );
    });
}

function scheduleLeaveNotTakenConfirmationOutbox(): void {
    after(() => {
        processOutbox().catch((error: unknown) =>
            console.error("Failed to process leave not-taken confirm outbox:", error),
        );
    });
}

async function authorizeMutation(
    req: NextRequest,
): Promise<
    | { ok: true; auth: Awaited<ReturnType<typeof requireActiveWorkforceSession>> & { ok: true } }
    | { ok: false; response: NextResponse }
> {
    if (!isFeatureEnabled(FEATURE_KEYS.leave)) {
        return { ok: false, response: notFound() };
    }
    const preAuthRateLimitResponse = enforcePreAuthIpRateLimit(
        req,
        "leave-not-taken",
    );
    if (preAuthRateLimitResponse) {
        return { ok: false, response: preAuthRateLimitResponse };
    }
    const bodySizeResponse = enforceLeaveJsonBodySize(req);
    if (bodySizeResponse) {
        return { ok: false, response: bodySizeResponse };
    }

    const auth = await requireActiveWorkforceSession();
    if (!auth.ok) return { ok: false, response: auth.response };
    const principalRateLimitResponse = enforceAuthenticatedMutationRateLimit(
        "leave-not-taken",
        auth.user.id,
    );
    if (principalRateLimitResponse) {
        return { ok: false, response: principalRateLimitResponse };
    }
    return { ok: true, auth };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    const authorization = await authorizeMutation(req);
    if (!authorization.ok) return authorization.response;
    return handleLeaveNotTakenRequest(
        req,
        authorization.auth,
        undefined,
        scheduleLeaveOutbox,
    );
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
    const authorization = await authorizeMutation(req);
    if (!authorization.ok) return authorization.response;
    return handleLeaveNotTakenConfirmation(req, authorization.auth, {
        allowAdminOverride: true,
        scheduleOutbox: scheduleLeaveNotTakenConfirmationOutbox,
    });
}
