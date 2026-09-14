import { NextResponse } from "next/server";

import {
    changeAuthorizationAdministrationTeamMemberRole,
    changeAuthorizationTeamMemberRoleSchema,
    removeAuthorizationAdministrationTeamMember,
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

type MemberRouteParams = Promise<{
    readonly id: string;
    readonly userId: string;
}>;

export async function PATCH(
    request: Request,
    { params }: { readonly params: MemberRouteParams },
): Promise<NextResponse> {
    try {
        const auth = await requireAuthorizationAdministrationApiSession();
        if (!auth.ok) return auth.response;
        const { id: rawTeamId, userId: rawUserId } = await params;
        const parsedTeamId = parseAdministrationId(rawTeamId);
        if (!parsedTeamId.ok) return parsedTeamId.response;
        const parsedUserId = parseAdministrationId(rawUserId);
        if (!parsedUserId.ok) return parsedUserId.response;
        const body = await readAuthorizationAdministrationJsonBody(request);
        if (!body.ok) return body.response;
        const parsed = changeAuthorizationTeamMemberRoleSchema.safeParse(body.body);
        if (!parsed.success) return badRequest({ code: "INVALID_INPUT" });

        const membership = await changeAuthorizationAdministrationTeamMemberRole(
            buildAuthorizationAdministrationMutationContext(auth, request),
            parsedTeamId.id,
            parsedUserId.id,
            parsed.data,
        );
        return NextResponse.json({ membership }, { status: 200 });
    } catch (error) {
        const response = authorizationAdministrationMutationErrorResponse(error);
        if (response) return response;
        console.error("Error changing Authorization Administration Team member role:", error);
        return operationFailed(500);
    }
}

export async function DELETE(
    request: Request,
    { params }: { readonly params: MemberRouteParams },
): Promise<NextResponse> {
    try {
        const auth = await requireAuthorizationAdministrationApiSession();
        if (!auth.ok) return auth.response;
        const { id: rawTeamId, userId: rawUserId } = await params;
        const parsedTeamId = parseAdministrationId(rawTeamId);
        if (!parsedTeamId.ok) return parsedTeamId.response;
        const parsedUserId = parseAdministrationId(rawUserId);
        if (!parsedUserId.ok) return parsedUserId.response;

        const membership = await removeAuthorizationAdministrationTeamMember(
            buildAuthorizationAdministrationMutationContext(auth, request),
            parsedTeamId.id,
            parsedUserId.id,
        );
        return NextResponse.json({ membership }, { status: 200 });
    } catch (error) {
        const response = authorizationAdministrationMutationErrorResponse(error);
        if (response) return response;
        console.error("Error removing Authorization Administration Team member:", error);
        return operationFailed(500);
    }
}
