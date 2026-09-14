import { NextResponse } from "next/server";

import {
    addAuthorizationAdministrationUserGrant,
    authorizationCapabilityGrantSchema,
    removeAuthorizationAdministrationUserGrant,
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

type UserGrantRouteParams = Promise<{ readonly id: string }>;

async function parseUserGrantRequest(
    request: Request,
    params: UserGrantRouteParams,
): Promise<
    | { readonly ok: true; readonly userId: number; readonly body: unknown }
    | { readonly ok: false; readonly response: NextResponse }
> {
    const { id: rawId } = await params;
    const parsedId = parseAdministrationId(rawId);
    if (!parsedId.ok) return parsedId;
    const body = await readAuthorizationAdministrationJsonBody(request);
    if (!body.ok) return body;
    return { ok: true, userId: parsedId.id, body: body.body };
}

export async function POST(
    request: Request,
    { params }: { readonly params: UserGrantRouteParams },
): Promise<NextResponse> {
    try {
        const auth = await requireAuthorizationAdministrationApiSession();
        if (!auth.ok) return auth.response;
        const route = await parseUserGrantRequest(request, params);
        if (!route.ok) return route.response;
        const parsed = authorizationCapabilityGrantSchema.safeParse(route.body);
        if (!parsed.success) return badRequest({ code: "INVALID_INPUT" });
        const grant = await addAuthorizationAdministrationUserGrant(
            buildAuthorizationAdministrationMutationContext(auth, request),
            route.userId,
            parsed.data,
        );
        return NextResponse.json({ grant }, { status: 201 });
    } catch (error) {
        const response = authorizationAdministrationMutationErrorResponse(error);
        if (response) return response;
        console.error("Error adding Authorization Administration User grant:", error);
        return operationFailed(500);
    }
}

export async function DELETE(
    request: Request,
    { params }: { readonly params: UserGrantRouteParams },
): Promise<NextResponse> {
    try {
        const auth = await requireAuthorizationAdministrationApiSession();
        if (!auth.ok) return auth.response;
        const route = await parseUserGrantRequest(request, params);
        if (!route.ok) return route.response;
        const parsed = authorizationCapabilityGrantSchema.safeParse(route.body);
        if (!parsed.success) return badRequest({ code: "INVALID_INPUT" });
        const grant = await removeAuthorizationAdministrationUserGrant(
            buildAuthorizationAdministrationMutationContext(auth, request),
            route.userId,
            parsed.data,
        );
        return NextResponse.json({ grant }, { status: 200 });
    } catch (error) {
        const response = authorizationAdministrationMutationErrorResponse(error);
        if (response) return response;
        console.error("Error removing Authorization Administration User grant:", error);
        return operationFailed(500);
    }
}

