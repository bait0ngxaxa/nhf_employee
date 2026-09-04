import { type NextRequest, NextResponse } from "next/server";

import { requireLiffWorkforceSession } from "@/lib/auth/liff";
import {
    serializeLiffRoutineTaskDetail,
} from "@/modules/routine";
import { createRoutineCommandActor } from "@/modules/routine";
import {
    readRoutineJsonBody,
    routineErrorResponse,
    routineFeatureGuard,
    routineRequestSizeGuard,
} from "@/modules/routine";
import { enforceAuthenticatedMutationRateLimit } from "@/lib/security/mutation-rate-limit";
import {
    deleteRoutineTask,
    getLiffRoutineTaskById,
    updateRoutineTask,
} from "@/modules/routine";
import {
    liffRoutineTaskUpdateSchema,
} from "@/modules/routine";
import {
    routineIdParamSchema,
    type RoutineTaskUpdateInput,
} from "@/modules/routine";

interface RouteContext {
    params: Promise<{ id: string }>;
}

type LiffSession = Extract<
    Awaited<ReturnType<typeof requireLiffWorkforceSession>>,
    { ok: true }
>;

function createLiffRoutineActor(
    auth: LiffSession,
    headers: Headers,
) {
    return createRoutineCommandActor(
        {
            id: auth.user.id,
            role: auth.user.role,
            email: auth.user.email,
        },
        headers,
        { mode: "LIFF_SELF_SERVICE" },
    );
}

async function parseTaskId(params: RouteContext["params"]): Promise<number | null> {
    const parsedId = routineIdParamSchema.safeParse((await params).id);
    return parsedId.success ? Number(parsedId.data) : null;
}

export async function GET(
    request: NextRequest,
    { params }: RouteContext,
): Promise<NextResponse> {
    const featureResponse = routineFeatureGuard("liff");
    if (featureResponse) return featureResponse;

    try {
        const auth = await requireLiffWorkforceSession();
        if (!auth.ok) return auth.response;

        const taskId = await parseTaskId(params);
        if (taskId === null) {
            return NextResponse.json({ error: "รหัสไม่ถูกต้อง" }, { status: 400 });
        }

        const actor = createLiffRoutineActor(auth, request.headers);
        const task = await getLiffRoutineTaskById(taskId, {
            actor,
            employeeId: auth.employeeId,
        });
        return NextResponse.json({ task: serializeLiffRoutineTaskDetail(task) });
    } catch (error) {
        return routineErrorResponse(error, "Error fetching LIFF routine task");
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: RouteContext,
): Promise<NextResponse> {
    const featureResponse = routineFeatureGuard("liff");
    if (featureResponse) return featureResponse;
    const sizeResponse = routineRequestSizeGuard(request);
    if (sizeResponse) return sizeResponse;

    try {
        const auth = await requireLiffWorkforceSession();
        if (!auth.ok) return auth.response;

        const rateLimitResponse = enforceAuthenticatedMutationRateLimit(
            "routine-task-update",
            auth.user.id,
        );
        if (rateLimitResponse) return rateLimitResponse;

        const taskId = await parseTaskId(params);
        if (taskId === null) {
            return NextResponse.json({ error: "รหัสไม่ถูกต้อง" }, { status: 400 });
        }

        const body = await readRoutineJsonBody(request);
        if (!body.ok) return body.response;

        const parsed = liffRoutineTaskUpdateSchema.safeParse(body.body);
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: "ข้อมูลไม่ถูกต้อง",
                    details: parsed.error.flatten().fieldErrors,
                },
                { status: 400 },
            );
        }

        const actor = createLiffRoutineActor(auth, request.headers);
        const input: RoutineTaskUpdateInput = parsed.data;
        const updated = await updateRoutineTask(taskId, input, actor);
        const task = await getLiffRoutineTaskById(updated.id, {
            actor,
            employeeId: auth.employeeId,
        });
        return NextResponse.json({ task: serializeLiffRoutineTaskDetail(task) });
    } catch (error) {
        return routineErrorResponse(error, "Error updating LIFF routine task");
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: RouteContext,
): Promise<NextResponse> {
    const featureResponse = routineFeatureGuard("liff");
    if (featureResponse) return featureResponse;

    try {
        const auth = await requireLiffWorkforceSession();
        if (!auth.ok) return auth.response;

        const rateLimitResponse = enforceAuthenticatedMutationRateLimit(
            "routine-task-delete",
            auth.user.id,
        );
        if (rateLimitResponse) return rateLimitResponse;

        const taskId = await parseTaskId(params);
        if (taskId === null) {
            return NextResponse.json({ error: "รหัสไม่ถูกต้อง" }, { status: 400 });
        }

        const actor = createLiffRoutineActor(auth, request.headers);
        await deleteRoutineTask(taskId, actor);
        return NextResponse.json({ success: true });
    } catch (error) {
        return routineErrorResponse(error, "Error deleting LIFF routine task");
    }
}
