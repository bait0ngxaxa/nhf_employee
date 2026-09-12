import { NextResponse } from "next/server";

import { requireLiffWorkforceSession } from "@/modules/line";
import {
    buildStockAuthorizationContext,
    resolveStockCapabilityForMigration,
    StockCapabilityDeniedError,
    stockService,
    toLiffStockRequestDetail,
    stockRequestIdParamSchema,
} from "@/modules/stock";
import { forbidden, notFound, serverError } from "@/lib/ssot/http";

interface RouteContext {
    params: Promise<{ id: string }>;
}

export async function GET(
    _request: Request,
    { params }: RouteContext,
): Promise<NextResponse> {
    const auth = await requireLiffWorkforceSession();
    if (!auth.ok) return auth.response;

    const parsedId = stockRequestIdParamSchema.safeParse((await params).id);
    if (!parsedId.success) return notFound();

    try {
        const authorization = buildStockAuthorizationContext(
            auth.user,
            auth.employeeId,
            "LIFF_SELF_SERVICE",
        );
        const readAuthorization = await resolveStockCapabilityForMigration(
            authorization,
            "stock.request.read",
            { requestedScope: "all" },
        );
        const canReadAll = readAuthorization.scopes.includes("ALL");
        const request = await stockService.getRequestById(
            parsedId.data,
            {
                userId: readAuthorization.actor.userId,
                scopes: readAuthorization.scopes,
            },
        );
        if (!request) return notFound();
        if (!canReadAll && request.requestedBy !== auth.user.id) {
            return notFound();
        }

        let canProcess = false;
        try {
            const processAuthorization =
                await resolveStockCapabilityForMigration(
                    authorization,
                    "stock.request.process",
                    { requestedScope: "all" },
                );
            canProcess = processAuthorization.scopes.includes("ALL");
        } catch (error) {
            if (!(error instanceof StockCapabilityDeniedError)) throw error;
        }

        let canCancel = false;
        try {
            const cancelAuthorization =
                await resolveStockCapabilityForMigration(
                    authorization,
                    "stock.request.cancel",
                    { requestedScope: "all" },
                );
            canCancel = cancelAuthorization.scopes.includes("ALL")
                || (
                    cancelAuthorization.scopes.includes("OWN")
                    && request.requestedBy === auth.user.id
                );
        } catch (error) {
            if (!(error instanceof StockCapabilityDeniedError)) throw error;
        }
        return NextResponse.json(
            toLiffStockRequestDetail(
                request,
                canProcess ? "PROCESSOR" : "REQUESTER",
                { canIssue: canProcess, canCancel },
            ),
        );
    } catch (error) {
        if (error instanceof StockCapabilityDeniedError) {
            return forbidden();
        }
        console.error("Error fetching LIFF stock request detail", {
            errorType: error instanceof Error ? error.name : "UnknownError",
        });
        return serverError();
    }
}
