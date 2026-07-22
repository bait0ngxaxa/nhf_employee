import { getTrustedClientIp } from "@/lib/network/trusted-client-ip";
import type { StockCommandActor } from "@/lib/services/stock";

type StockActorUser = {
    id: number;
    email: string;
    name?: string | null;
};

export function createStockCommandActor(
    user: StockActorUser,
    requestHeaders: Headers,
): StockCommandActor {
    return {
        id: user.id,
        email: user.email,
        name: user.name ?? user.email,
        ipAddress: getTrustedClientIp(requestHeaders) ?? undefined,
        userAgent: requestHeaders.get("user-agent") ?? undefined,
    };
}
