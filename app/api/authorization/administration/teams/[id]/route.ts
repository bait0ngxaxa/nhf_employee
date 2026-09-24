import { NextResponse, type NextRequest } from "next/server";

import { withTrustedMutation } from "@/lib/auth/csrf";

import {
    updateAuthorizationAdministrationTeam,
    updateAuthorizationTeamSchema,
    getAuthorizationAdministrationTeam,
    AuthorizationAdministrationInputError,
} from "@/modules/authorization";
import {
    badRequest,
    notFound,
    operationFailed,
} from "@/lib/ssot/http";
import { parseAdministrationId } from "../../_lib/route-input";
import {
    authorizationAdministrationMutationErrorResponse,
    readAuthorizationAdministrationJsonBody,
} from "../../_lib/mutation-route";
import {
    buildAuthorizationAdministrationMutationContext,
    requireAuthorizationAdministrationApiSession,
} from "../../_lib/route-auth";

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

        const team = await getAuthorizationAdministrationTeam(
            auth.principal,
            parsedId.id,
        );
        if (team === null) return notFound();

        return NextResponse.json({ team }, { status: 200 });
    } catch (error) {
        if (error instanceof AuthorizationAdministrationInputError) {
            return badRequest({ code: error.code });
        }
        console.error("Error reading Authorization Administration Team:", error);
        return operationFailed(500);
    }
}

export const PATCH = withTrustedMutation(async (
    request: NextRequest,
    { params }: { readonly params: Promise<{ readonly id: string }> },
): Promise<NextResponse> => {
    try {
        const auth = await requireAuthorizationAdministrationApiSession();
        if (!auth.ok) return auth.response;

        const { id: rawId } = await params;
        const parsedId = parseAdministrationId(rawId);
        if (!parsedId.ok) return parsedId.response;
        const body = await readAuthorizationAdministrationJsonBody(request);
        if (!body.ok) return body.response;
        const parsed = updateAuthorizationTeamSchema.safeParse(body.body);
        if (!parsed.success) return badRequest({ code: "INVALID_INPUT" });

        const team = await updateAuthorizationAdministrationTeam(
            buildAuthorizationAdministrationMutationContext(auth, request),
            parsedId.id,
            parsed.data,
        );
        return NextResponse.json({ team }, { status: 200 });
    } catch (error) {
        const response = authorizationAdministrationMutationErrorResponse(error);
        if (response) return response;
        console.error("Error updating Authorization Administration Team:", error);
        return operationFailed(500);
    }
});
