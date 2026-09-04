import { type NextRequest, NextResponse } from "next/server";

import { requireActiveWorkforceOrAdminSession } from "@/lib/auth/workforce";
import { createRoutineCommandActor } from "@/modules/routine";
import { enforceAuthenticatedMutationRateLimit } from "@/lib/security/mutation-rate-limit";
import {
    readRoutineJsonBody,
    routineErrorResponse,
    routineFeatureGuard,
    routineRequestSizeGuard,
} from "@/modules/routine";
import {
    deleteRoutineTask,
    getRoutineTaskById,
    updateRoutineTask,
} from "@/modules/routine";
import {
    routineIdParamSchema,
    routineTaskUpdateSchema,
} from "@/modules/routine";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    const featureResponse = routineFeatureGuard();
    if (featureResponse) return featureResponse;

    try {
        const auth = await requireActiveWorkforceOrAdminSession();
        if (!auth.ok) return auth.response;
        const { id: rawId } = await params;
        const parsedId = routineIdParamSchema.safeParse(rawId);
        if (!parsedId.success) return NextResponse.json({ error: "รหัสไม่ถูกต้อง" }, { status: 400 });
        const actor = createRoutineCommandActor(
            {
                id: auth.user.id,
                role: auth.user.role ?? "USER",
                email: auth.user.email ?? "",
            },
            request.headers,
        );
        const task = await getRoutineTaskById(Number(parsedId.data), {
            actor,
            employeeId: "employeeId" in auth ? auth.employeeId : null,
        });
        return NextResponse.json({ task });
    } catch (error) {
        return routineErrorResponse(error, "Error fetching routine task");
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    const featureResponse = routineFeatureGuard();
    if (featureResponse) return featureResponse;
    const sizeResponse = routineRequestSizeGuard(request);
    if (sizeResponse) return sizeResponse;

    try {
        const auth = await requireActiveWorkforceOrAdminSession();
        if (!auth.ok) return auth.response;
        const rateLimitResponse = enforceAuthenticatedMutationRateLimit(
            "routine-task-update",
            auth.user.id,
        );
        if (rateLimitResponse) return rateLimitResponse;
        const { id: rawId } = await params;
        const parsedId = routineIdParamSchema.safeParse(rawId);
        if (!parsedId.success) return NextResponse.json({ error: "รหัสไม่ถูกต้อง" }, { status: 400 });
        const body = await readRoutineJsonBody(request);
        if (!body.ok) return body.response;
        const parsed = routineTaskUpdateSchema.safeParse(body.body);
        if (!parsed.success) {
            return NextResponse.json(
                { error: "ข้อมูลไม่ถูกต้อง", details: parsed.error.flatten().fieldErrors },
                { status: 400 },
            );
        }
        const actor = createRoutineCommandActor(
            {
                id: auth.user.id,
                role: auth.user.role ?? "USER",
                email: auth.user.email ?? "",
            },
            request.headers,
        );
        const task = await updateRoutineTask(Number(parsedId.data), parsed.data, actor);
        return NextResponse.json({ task });
    } catch (error) {
        return routineErrorResponse(error, "Error updating routine task");
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    const featureResponse = routineFeatureGuard();
    if (featureResponse) return featureResponse;

    try {
        const auth = await requireActiveWorkforceOrAdminSession();
        if (!auth.ok) return auth.response;
        const rateLimitResponse = enforceAuthenticatedMutationRateLimit(
            "routine-task-delete",
            auth.user.id,
        );
        if (rateLimitResponse) return rateLimitResponse;
        const { id: rawId } = await params;
        const parsedId = routineIdParamSchema.safeParse(rawId);
        if (!parsedId.success) {
            return NextResponse.json({ error: "รหัสไม่ถูกต้อง" }, { status: 400 });
        }
        const actor = createRoutineCommandActor(
            {
                id: auth.user.id,
                role: auth.user.role ?? "USER",
                email: auth.user.email ?? "",
            },
            request.headers,
        );
        await deleteRoutineTask(Number(parsedId.data), actor);
        return NextResponse.json({ success: true });
    } catch (error) {
        return routineErrorResponse(error, "Error deleting routine task");
    }
}
