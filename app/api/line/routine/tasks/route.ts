import { type NextRequest, NextResponse } from "next/server";

import { requireLiffWorkforceSession } from "@/lib/auth/liff";
import { createRoutineCommandActor } from "@/lib/server/routine-command-actor";
import {
    serializeLiffRoutineTaskDetail,
    serializeLiffRoutineTasks,
} from "@/lib/server/line-routine-api";
import {
    routineErrorResponse,
    routineFeatureGuard,
    routineRequestSizeGuard,
    readRoutineJsonBody,
} from "@/lib/server/routine-api";
import { enforceAuthenticatedMutationRateLimit } from "@/lib/security/mutation-rate-limit";
import {
    createRoutineTask,
    getLiffRoutineTaskById,
    getRoutineTaskWorkItems,
} from "@/lib/services/routine";
import { idempotencyKeySchema } from "@/lib/validations/idempotency";
import {
    liffRoutineTaskCreateSchema,
    liffRoutineTaskQuerySchema,
} from "@/lib/validations/line-routine";
import type { RoutineTaskCreateInput } from "@/lib/validations/routine";

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

export async function GET(request: NextRequest): Promise<NextResponse> {
    const featureResponse = routineFeatureGuard("liff");
    if (featureResponse) return featureResponse;

    try {
        const auth = await requireLiffWorkforceSession();
        if (!auth.ok) return auth.response;

        const params = request.nextUrl.searchParams;
        const parsed = liffRoutineTaskQuerySchema.safeParse({
            timingStatus: params.get("timingStatus") ?? undefined,
            taskId: params.get("taskId") ?? undefined,
            occurrenceId: params.get("occurrenceId") ?? undefined,
            page: params.get("page") ?? undefined,
            limit: params.get("limit") ?? undefined,
        });
        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: "พารามิเตอร์ Routine ไม่ถูกต้อง",
                    details: parsed.error.flatten().fieldErrors,
                },
                { status: 400 },
            );
        }

        const actor = createLiffRoutineActor(auth, request.headers);

        const result = await getRoutineTaskWorkItems(
            {
                taskId: parsed.data.taskId,
                occurrenceId: parsed.data.occurrenceId,
                timingStatus: parsed.data.timingStatus,
                scope: "mine",
                page: parsed.data.page,
                limit: parsed.data.limit,
            },
            {
                actor,
                employeeId: auth.employeeId,
            },
        );
        return NextResponse.json(serializeLiffRoutineTasks(result));
    } catch (error) {
        return routineErrorResponse(error, "Error fetching LIFF routine tasks");
    }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    const featureResponse = routineFeatureGuard("liff");
    if (featureResponse) return featureResponse;
    const sizeResponse = routineRequestSizeGuard(request);
    if (sizeResponse) return sizeResponse;

    try {
        const auth = await requireLiffWorkforceSession();
        if (!auth.ok) return auth.response;

        const idempotencyKey = idempotencyKeySchema.safeParse(
            request.headers.get("Idempotency-Key"),
        );
        if (!idempotencyKey.success) {
            return NextResponse.json(
                { error: "คำขอสร้าง Routine ต้องมี Idempotency-Key ที่ถูกต้อง" },
                { status: 400 },
            );
        }

        const rateLimitResponse = enforceAuthenticatedMutationRateLimit(
            "routine-task-create",
            auth.user.id,
        );
        if (rateLimitResponse) return rateLimitResponse;

        const body = await readRoutineJsonBody(request);
        if (!body.ok) return body.response;

        const parsed = liffRoutineTaskCreateSchema.safeParse(body.body);
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
        const input: RoutineTaskCreateInput = {
            ...parsed.data,
            assignees: [{ employeeId: auth.employeeId, role: "OWNER" }],
        };
        const result = await createRoutineTask(input, actor, {
            idempotencyKey: idempotencyKey.data,
        });
        const task = await getLiffRoutineTaskById(result.task.id, {
            actor,
            employeeId: auth.employeeId,
        });

        return NextResponse.json(
            {
                task: serializeLiffRoutineTaskDetail(task),
                replayed: result.replayed,
            },
            { status: result.replayed ? 200 : 201 },
        );
    } catch (error) {
        return routineErrorResponse(error, "Error creating LIFF routine task");
    }
}
