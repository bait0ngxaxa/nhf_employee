import { NextResponse } from "next/server";

import {
    updateAuthorizationAdministrationTeamRole,
    updateAuthorizationTeamRoleSchema,
} from "@/modules/authorization";
import { badRequest, operationFailed } from "@/lib/ssot/http";
import { parseAdministrationId } from "../../../../_lib/route-input";
import {
    authorizationAdministrationMutationErrorResponse,
    readAuthorizationAdministrationJsonBody,
} from "../../../../_lib/mutation-route";
import {
    buildAuthorizationAdministrationMutationContext,
    requireAuthorizationAdministrationApiSession,
} from "../../../../_lib/route-auth";

export async function PATCH(
    request: Request,
    {
        params,
    }: {
        readonly params: Promise<{
            readonly id: string;
            readonly roleId: string;
        }>;
    },
): Promise<NextResponse> {
    try {
        const auth = await requireAuthorizationAdministrationApiSession();
        if (!auth.ok) return auth.response;
        const { id: rawTeamId, roleId: rawRoleId } = await params;
        const parsedTeamId = parseAdministrationId(rawTeamId);
        if (!parsedTeamId.ok) return parsedTeamId.response;
        const parsedRoleId = parseAdministrationId(rawRoleId);
        if (!parsedRoleId.ok) return parsedRoleId.response;
        const body = await readAuthorizationAdministrationJsonBody(request);
        if (!body.ok) return body.response;
        const parsed = updateAuthorizationTeamRoleSchema.safeParse(body.body);
        if (!parsed.success) return badRequest({ code: "INVALID_INPUT" });

        const role = await updateAuthorizationAdministrationTeamRole(
            buildAuthorizationAdministrationMutationContext(auth, request),
            parsedTeamId.id,
            parsedRoleId.id,
            parsed.data,
        );
        return NextResponse.json({ role }, { status: 200 });
    } catch (error) {
        const response = authorizationAdministrationMutationErrorResponse(error);
        if (response) return response;
        console.error("Error updating Authorization Administration TeamRole:", error);
        return operationFailed(500);
    }
}
