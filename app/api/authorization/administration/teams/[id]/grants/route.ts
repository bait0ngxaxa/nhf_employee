import { NextResponse, type NextRequest } from "next/server";

import { withTrustedMutation } from "@/lib/auth/csrf";

import {
    addAuthorizationAdministrationTeamGrant,
    authorizationCapabilityGrantSchema,
    removeAuthorizationAdministrationTeamGrant,
} from "@/modules/authorization";
import { badRequest, operationFailed } from "@/lib/ssot/http";
import { parseAdministrationId } from "../../../_lib/route-input";
import {
    authorizationAdministrationMutationErrorResponse,
    readAuthorizationAdministrationJsonBody,
} from "../../../_lib/mutation-route";
import {
    buildAuthorizationAdministrationMutationContext,
    requireAuthorizationAdministrationApiSession,
} from "../../../_lib/route-auth";

type TeamGrantRouteParams = Promise<{ readonly id: string }>;

export const POST = withTrustedMutation(async (
    request: NextRequest,
    { params }: { readonly params: TeamGrantRouteParams },
): Promise<NextResponse> => {
    try {
        const auth = await requireAuthorizationAdministrationApiSession();
        if (!auth.ok) return auth.response;
        const { id: rawTeamId } = await params;
        const parsedTeamId = parseAdministrationId(rawTeamId);
        if (!parsedTeamId.ok) return parsedTeamId.response;
        const body = await readAuthorizationAdministrationJsonBody(request);
        if (!body.ok) return body.response;
        const parsed = authorizationCapabilityGrantSchema.safeParse(body.body);
        if (!parsed.success) return badRequest({ code: "INVALID_INPUT" });

        const grant = await addAuthorizationAdministrationTeamGrant(
            buildAuthorizationAdministrationMutationContext(auth, request),
            parsedTeamId.id,
            parsed.data,
        );
        return NextResponse.json({ grant }, { status: 201 });
    } catch (error) {
        const response = authorizationAdministrationMutationErrorResponse(error);
        if (response) return response;
        console.error("Error adding Authorization Administration Team grant:", error);
        return operationFailed(500);
    }
});

export const DELETE = withTrustedMutation(async (
    request: NextRequest,
    { params }: { readonly params: TeamGrantRouteParams },
): Promise<NextResponse> => {
    try {
        const auth = await requireAuthorizationAdministrationApiSession();
        if (!auth.ok) return auth.response;
        const { id: rawTeamId } = await params;
        const parsedTeamId = parseAdministrationId(rawTeamId);
        if (!parsedTeamId.ok) return parsedTeamId.response;
        const body = await readAuthorizationAdministrationJsonBody(request);
        if (!body.ok) return body.response;
        const parsed = authorizationCapabilityGrantSchema.safeParse(body.body);
        if (!parsed.success) return badRequest({ code: "INVALID_INPUT" });

        const grant = await removeAuthorizationAdministrationTeamGrant(
            buildAuthorizationAdministrationMutationContext(auth, request),
            parsedTeamId.id,
            parsed.data,
        );
        return NextResponse.json({ grant }, { status: 200 });
    } catch (error) {
        const response = authorizationAdministrationMutationErrorResponse(error);
        if (response) return response;
        console.error("Error removing Authorization Administration Team grant:", error);
        return operationFailed(500);
    }
});
