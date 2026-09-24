import { NextResponse, type NextRequest } from "next/server";

import { withTrustedMutation } from "@/lib/auth/csrf";

import {
    createAuthorizationAdministrationTeamRole,
    createAuthorizationTeamRoleSchema,
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

export const POST = withTrustedMutation(async (
    request: NextRequest,
    { params }: { readonly params: Promise<{ readonly id: string }> },
): Promise<NextResponse> => {
    try {
        const auth = await requireAuthorizationAdministrationApiSession();
        if (!auth.ok) return auth.response;
        const { id: rawTeamId } = await params;
        const parsedTeamId = parseAdministrationId(rawTeamId);
        if (!parsedTeamId.ok) return parsedTeamId.response;
        const body = await readAuthorizationAdministrationJsonBody(request);
        if (!body.ok) return body.response;
        const parsed = createAuthorizationTeamRoleSchema.safeParse(body.body);
        if (!parsed.success) return badRequest({ code: "INVALID_INPUT" });

        const role = await createAuthorizationAdministrationTeamRole(
            buildAuthorizationAdministrationMutationContext(auth, request),
            parsedTeamId.id,
            parsed.data,
        );
        return NextResponse.json({ role }, { status: 201 });
    } catch (error) {
        const response = authorizationAdministrationMutationErrorResponse(error);
        if (response) return response;
        console.error("Error creating Authorization Administration TeamRole:", error);
        return operationFailed(500);
    }
});
