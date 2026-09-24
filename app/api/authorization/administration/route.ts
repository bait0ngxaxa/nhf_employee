import { NextResponse, type NextRequest } from "next/server";

import { withTrustedMutation } from "@/lib/auth/csrf";

import {
    createAuthorizationAdministrationTeam,
    createAuthorizationTeamSchema,
    getAuthorizationAdministrationOverview,
} from "@/modules/authorization";
import { badRequest, operationFailed } from "@/lib/ssot/http";
import {
    authorizationAdministrationMutationErrorResponse,
    readAuthorizationAdministrationJsonBody,
} from "./_lib/mutation-route";
import {
    buildAuthorizationAdministrationMutationContext,
    requireAuthorizationAdministrationApiSession,
} from "./_lib/route-auth";

export async function GET(): Promise<NextResponse> {
    try {
        const auth = await requireAuthorizationAdministrationApiSession();
        if (!auth.ok) return auth.response;

        const overview = await getAuthorizationAdministrationOverview(
            auth.principal,
        );
        return NextResponse.json({ overview }, { status: 200 });
    } catch (error) {
        console.error("Error reading Authorization Administration overview:", error);
        return operationFailed(500);
    }
}

export const POST = withTrustedMutation(async (request: NextRequest): Promise<NextResponse> => {
    try {
        const auth = await requireAuthorizationAdministrationApiSession();
        if (!auth.ok) return auth.response;

        const body = await readAuthorizationAdministrationJsonBody(request);
        if (!body.ok) return body.response;
        const parsed = createAuthorizationTeamSchema.safeParse(body.body);
        if (!parsed.success) return badRequest({ code: "INVALID_INPUT" });

        const team = await createAuthorizationAdministrationTeam(
            buildAuthorizationAdministrationMutationContext(auth, request),
            parsed.data,
        );
        return NextResponse.json({ team }, { status: 201 });
    } catch (error) {
        const response = authorizationAdministrationMutationErrorResponse(error);
        if (response) return response;
        console.error("Error creating Authorization Administration Team:", error);
        return operationFailed(500);
    }
});
