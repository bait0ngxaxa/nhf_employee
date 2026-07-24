import { randomUUID } from "node:crypto";

import { getTrustedClientIp } from "@/lib/network/trusted-client-ip";
import type { UserContext } from "@/lib/services/ticket";

const TRACE_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

function getTraceId(headers: Headers, name: string): string | undefined {
    const value = headers.get(name)?.trim();
    return value && TRACE_ID_PATTERN.test(value) ? value : undefined;
}

export function createTicketCommandActor(
    user: UserContext,
    headers: Headers,
): UserContext {
    const requestId = getTraceId(headers, "x-request-id") ?? randomUUID();

    return {
        ...user,
        ipAddress: getTrustedClientIp(headers) ?? undefined,
        userAgent: headers.get("user-agent") ?? undefined,
        requestId,
        correlationId:
            getTraceId(headers, "x-correlation-id") ?? requestId,
    };
}
