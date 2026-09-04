import { type NextRequest, NextResponse } from "next/server";

import { requireActiveWorkforceOrAdminSession } from "@/lib/auth/workforce";
import { createRoutineCommandActor } from "@/modules/routine";
import { enforceAuthenticatedMutationRateLimit } from "@/lib/security/mutation-rate-limit";
import { idempotencyKeySchema } from "@/lib/validations/idempotency";
import {
    readRoutineJsonBody,
    routineErrorResponse,
    routineFeatureGuard,
    routineRequestSizeGuard,
} from "@/modules/routine";
import {
    createRoutineTask,
    getRoutineTasks,
} from "@/modules/routine";
import {
    routineTaskCreateSchema,
    routineTaskFiltersSchema,
} from "@/modules/routine";

export async function GET(request: NextRequest): Promise<NextResponse> {
    const featureResponse = routineFeatureGuard();
    if (featureResponse) return featureResponse;

    try {
        const auth = await requireActiveWorkforceOrAdminSession();
        if (!auth.ok) return auth.response;
        const actor = createRoutineCommandActor(
            {
                id: auth.user.id,
                role: auth.user.role ?? "USER",
                email: auth.user.email ?? "",
            },
            request.headers,
        );
        const queryActor = {
            actor,
            employeeId: "employeeId" in auth ? auth.employeeId : null,
        };
        const params = request.nextUrl.searchParams;
        const parsed = routineTaskFiltersSchema.safeParse({
            activeOnly: params.get("activeOnly") ?? undefined,
            status: params.get("status") ?? undefined,
            unitId: params.get("unitId") ?? undefined,
            categoryId: params.get("categoryId") ?? undefined,
            search: params.get("search") ?? undefined,
            page: params.get("page") ?? undefined,
            limit: params.get("limit") ?? undefined,
        });
        if (!parsed.success) {
            return NextResponse.json(
                { error: "พารามิเตอร์ไม่ถูกต้อง", details: parsed.error.flatten().fieldErrors },
                { status: 400 },
            );
        }
        return NextResponse.json(await getRoutineTasks(parsed.data, queryActor));
    } catch (error) {
        return routineErrorResponse(error, "Error fetching routine tasks");
    }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
    const featureResponse = routineFeatureGuard();
    if (featureResponse) return featureResponse;
    const sizeResponse = routineRequestSizeGuard(request);
    if (sizeResponse) return sizeResponse;

    try {
        const auth = await requireActiveWorkforceOrAdminSession();
        if (!auth.ok) return auth.response;
        const idempotencyKey = idempotencyKeySchema.safeParse(
            request.headers.get("idempotency-key"),
        );
        if (!idempotencyKey.success) {
            return NextResponse.json(
                { error: "คำขอสร้าง Routine ต้องมี Idempotency-Key" },
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
        const parsed = routineTaskCreateSchema.safeParse(body.body);
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
        const result = await createRoutineTask(parsed.data, actor, {
            idempotencyKey: idempotencyKey.data,
        });
        return NextResponse.json(
            { task: result.task, replayed: result.replayed },
            { status: result.replayed ? 200 : 201 },
        );
    } catch (error) {
        return routineErrorResponse(error, "Error creating routine task");
    }
}
