import { NextResponse, type NextRequest } from "next/server";

import { withTrustedMutation } from "@/lib/auth/csrf";

import {
    changeSystemRole,
    SystemRoleChangeError,
    systemRoleChangeSchema,
} from "@/modules/auth";
import { badRequest, forbidden, jsonError, notFound, operationFailed } from "@/lib/ssot/http";
import { parseAdministrationId } from "../../../_lib/route-input";
import {
    buildAuthorizationAdministrationMutationContext,
    requireAuthorizationAdministrationApiSession,
} from "../../../_lib/route-auth";
import { readAuthorizationAdministrationJsonBody } from "../../../_lib/mutation-route";

type SystemRoleRouteParams = Promise<{ readonly id: string }>;

export const PATCH = withTrustedMutation(async (
    request: NextRequest,
    { params }: { readonly params: SystemRoleRouteParams },
): Promise<NextResponse> => {
    try {
        const auth = await requireAuthorizationAdministrationApiSession();
        if (!auth.ok) return auth.response;

        const { id: rawId } = await params;
        const parsedId = parseAdministrationId(rawId);
        if (!parsedId.ok) return parsedId.response;

        const body = await readAuthorizationAdministrationJsonBody(request);
        if (!body.ok) return body.response;
        const parsed = systemRoleChangeSchema.safeParse(body.body);
        if (!parsed.success) return badRequest({ code: "INVALID_INPUT" });

        const context = buildAuthorizationAdministrationMutationContext(auth, request);
        const result = await changeSystemRole({
            targetUserId: parsedId.id,
            systemRole: parsed.data.systemRole,
            actor: {
                userId: context.principal.userId,
                userEmail: context.userEmail ?? null,
                ipAddress: context.ipAddress ?? null,
                userAgent: context.userAgent ?? null,
            },
        });
        return NextResponse.json({ result }, { status: 200 });
    } catch (error) {
        if (error instanceof SystemRoleChangeError) {
            if (error.code === "INVALID_INPUT") return badRequest({ code: error.code });
            if (error.code === "NOT_FOUND") return notFound({ code: error.code });
            if (error.code === "SELF_DEMOTION") return forbidden({ code: error.code });
            return jsonError(
                "Authorization Administration mutation rejected",
                error.statusCode,
                { code: error.code },
            );
        }
        console.error("Error changing Authorization Administration system role:", error);
        return operationFailed(500);
    }
});
