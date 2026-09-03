import { NextResponse } from "next/server";

import { requireLiffWorkforceSession } from "@/lib/auth/liff";
import {
    stockService,
    toLiffStockRequestDetail,
    stockRequestIdParamSchema,
} from "@/modules/stock";
import { isAdminRole } from "@/lib/ssot/permissions";
import { notFound, serverError } from "@/lib/ssot/http";

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
        const request = await stockService.getRequestById(parsedId.data);
        if (!request) return notFound();

        const canProcess = isAdminRole(auth.user.role);
        if (!canProcess && request.requestedBy !== auth.user.id) {
            return notFound();
        }
        return NextResponse.json(
            toLiffStockRequestDetail(
                request,
                canProcess ? "PROCESSOR" : "REQUESTER",
            ),
        );
    } catch (error) {
        console.error("Error fetching LIFF stock request detail", {
            errorType: error instanceof Error ? error.name : "UnknownError",
        });
        return serverError();
    }
}
