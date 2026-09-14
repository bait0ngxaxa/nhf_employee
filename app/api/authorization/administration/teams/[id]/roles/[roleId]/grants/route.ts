import { NextResponse } from "next/server";

import {
    addAuthorizationAdministrationTeamRoleGrant,
    authorizationCapabilityGrantSchema,
    removeAuthorizationAdministrationTeamRoleGrant,
} from "@/modules/authorization";
import { badRequest, operationFailed } from "@/lib/ssot/http";
import { parseAdministrationId } from "../../../../../_lib/route-input";
import {
    authorizationAdministrationMutationErrorResponse,
    readAuthorizationAdministrationJsonBody,
} from "../../../../../_lib/mutation-route";
import {
    buildAuthorizationAdministrationMutationContext,
    requireAuthorizationAdministrationApiSession,
} from "../../../../../_lib/route-auth";

type TeamRoleGrantRouteParams = Promise<{
    readonly teamId: string;
    readonly roleId: string;
}>;

async function parseGrantRoute(
    request: Request,
    params: TeamRoleGrantRouteParams,
): Promise<
    | {
        readonly ok: true;
        readonly teamId: number;
        readonly roleId: number;
        readonly body: unknown;
    }
    | { readonly ok: false; readonly response: NextResponse }
> {
    const { teamId: rawTeamId, roleId: rawRoleId } = await params;
    const parsedTeamId = parseAdministrationId(rawTeamId);
    if (!parsedTeamId.ok) return parsedTeamId;
    const parsedRoleId = parseAdministrationId(rawRoleId);
    if (!parsedRoleId.ok) return parsedRoleId;
    const body = await readAuthorizationAdministrationJsonBody(request);
    if (!body.ok) return body;
    return {
        ok: true,
        teamId: parsedTeamId.id,
        roleId: parsedRoleId.id,
        body: body.body,
    };
}

export async function POST(
    request: Request,
    { params }: { readonly params: TeamRoleGrantRouteParams },
): Promise<NextResponse> {
    try {
        const auth = await requireAuthorizationAdministrationApiSession();
        if (!auth.ok) return auth.response;
        const route = await parseGrantRoute(request, params);
        if (!route.ok) return route.response;
        const parsed = authorizationCapabilityGrantSchema.safeParse(route.body);
        if (!parsed.success) return badRequest({ code: "INVALID_INPUT" });
        const grant = await addAuthorizationAdministrationTeamRoleGrant(
            buildAuthorizationAdministrationMutationContext(auth, request),
            route.teamId,
            route.roleId,
            parsed.data,
        );
        return NextResponse.json({ grant }, { status: 201 });
    } catch (error) {
        const response = authorizationAdministrationMutationErrorResponse(error);
        if (response) return response;
        console.error("Error adding Authorization Administration TeamRole grant:", error);
        return operationFailed(500);
    }
}

export async function DELETE(
    request: Request,
    { params }: { readonly params: TeamRoleGrantRouteParams },
): Promise<NextResponse> {
    try {
        const auth = await requireAuthorizationAdministrationApiSession();
        if (!auth.ok) return auth.response;
        const route = await parseGrantRoute(request, params);
        if (!route.ok) return route.response;
        const parsed = authorizationCapabilityGrantSchema.safeParse(route.body);
        if (!parsed.success) return badRequest({ code: "INVALID_INPUT" });
        const grant = await removeAuthorizationAdministrationTeamRoleGrant(
            buildAuthorizationAdministrationMutationContext(auth, request),
            route.teamId,
            route.roleId,
            parsed.data,
        );
        return NextResponse.json({ grant }, { status: 200 });
    } catch (error) {
        const response = authorizationAdministrationMutationErrorResponse(error);
        if (response) return response;
        console.error("Error removing Authorization Administration TeamRole grant:", error);
        return operationFailed(500);
    }
}

