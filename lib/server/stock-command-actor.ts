import { getTrustedClientIp } from "@/lib/network/trusted-client-ip";
import type { StockCommandActor } from "@/lib/services/stock";
import { randomUUID } from "node:crypto";

type StockActorUser = {
    id: number;
    email: string;
    name?: string | null;
};

const TRACE_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

function getTraceId(requestHeaders: Headers, name: string): string | undefined {
    const value = requestHeaders.get(name)?.trim();
    return value && TRACE_ID_PATTERN.test(value) ? value : undefined;
}

export function createStockCommandActor(
    user: StockActorUser,
    requestHeaders: Headers,
): StockCommandActor {
    const requestId = getTraceId(requestHeaders, "x-request-id") ?? randomUUID();
    const correlationId =
        getTraceId(requestHeaders, "x-correlation-id") ?? requestId;

    return {
        id: user.id,
        email: user.email,
        name: user.name ?? user.email,
        ipAddress: getTrustedClientIp(requestHeaders) ?? undefined,
        userAgent: requestHeaders.get("user-agent") ?? undefined,
        requestId,
        correlationId,
    };
}
