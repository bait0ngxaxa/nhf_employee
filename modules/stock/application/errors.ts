import type { AuthorizationDecision } from "@/modules/authorization";

export class StockCapabilityDeniedError extends Error {
    readonly authorizationReason: AuthorizationDecision["reason"];
    readonly capability: string;
    readonly statusCode = 403;

    constructor(
        capability: string,
        reason: AuthorizationDecision["reason"],
    ) {
        super("คุณไม่มีสิทธิ์ดำเนินการ");
        this.name = "StockCapabilityDeniedError";
        this.capability = capability;
        this.authorizationReason = reason;
    }
}
