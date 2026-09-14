import { NextResponse } from "next/server";

import {
    AUTHORIZATION_ADMINISTRATION_USER_SEARCH_MAX_LENGTH,
    AuthorizationAdministrationInputError,
    searchAuthorizationAdministrationUsers,
} from "@/modules/authorization";
import { badRequest, operationFailed } from "@/lib/ssot/http";
import { requireAuthorizationAdministrationApiSession } from "../_lib/route-auth";

export async function GET(request: Request): Promise<NextResponse> {
    try {
        const auth = await requireAuthorizationAdministrationApiSession();
        if (!auth.ok) return auth.response;

        const query = new URL(request.url).searchParams.get("query") ?? "";
        if (
            query.length > AUTHORIZATION_ADMINISTRATION_USER_SEARCH_MAX_LENGTH
            || query.trim().length === 0
        ) {
            return badRequest({ code: "INVALID_INPUT" });
        }
        const users = await searchAuthorizationAdministrationUsers(
            auth.principal,
            query,
        );

        return NextResponse.json({ users }, { status: 200 });
    } catch (error) {
        if (error instanceof AuthorizationAdministrationInputError) {
            return badRequest({ code: error.code });
        }
        console.error("Error searching Authorization Administration Users:", error);
        return operationFailed(500);
    }
}
