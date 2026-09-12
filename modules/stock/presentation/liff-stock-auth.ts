import { requireLiffWorkforceSession } from "@/modules/line";
import { forbidden } from "@/lib/ssot/http";
import {
    buildStockAuthorizationContext,
    resolveStockCapabilityForMigration,
} from "../application/authorization";
import { StockCapabilityDeniedError } from "../application/errors";

export async function requireLiffStockProcessorSession(): Promise<
    Awaited<ReturnType<typeof requireLiffWorkforceSession>>
> {
    const auth = await requireLiffWorkforceSession();
    if (!auth.ok) return auth;

    const authorization = buildStockAuthorizationContext(
        auth.user,
        auth.employeeId,
        "LIFF_SELF_SERVICE",
    );
    try {
        await resolveStockCapabilityForMigration(
            authorization,
            "stock.request.process",
            { requestedScope: "all" },
        );
    } catch (error) {
        if (error instanceof StockCapabilityDeniedError) {
            return { ok: false, response: forbidden() };
        }
        throw error;
    }

    return auth;
}
