import { NextResponse } from "next/server";

import {
    AuthorizationAdministrationInputError,
    getAuthorizationAdministrationUser,
} from "@/modules/authorization";
import {
    badRequest,
    notFound,
    operationFailed,
} from "@/lib/ssot/http";
import {
    authorizationAdministrationEffectiveAccessProvider,
} from "../../_lib/effective-access";
import { parseAdministrationId } from "../../_lib/route-input";
import { requireAuthorizationAdministrationApiSession } from "../../_lib/route-auth";

export async function GET(
    _request: Request,
    { params }: { readonly params: Promise<{ readonly id: string }> },
): Promise<NextResponse> {
    try {
        const auth = await requireAuthorizationAdministrationApiSession();
        if (!auth.ok) return auth.response;

        const { id: rawId } = await params;
        const parsedId = parseAdministrationId(rawId);
        if (!parsedId.ok) return parsedId.response;

        const user = await getAuthorizationAdministrationUser(
            auth.principal,
            parsedId.id,
            { effectiveAccessProvider: authorizationAdministrationEffectiveAccessProvider },
        );
        if (user === null) return notFound();

        return NextResponse.json({ user }, { status: 200 });
    } catch (error) {
        if (error instanceof AuthorizationAdministrationInputError) {
            return badRequest({ code: error.code });
        }
        console.error("Error reading Authorization Administration User:", error);
        return operationFailed(500);
    }
}
