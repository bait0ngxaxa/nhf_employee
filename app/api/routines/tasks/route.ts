import { type NextRequest, NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth/api";
import { createRoutineCommandActor } from "@/lib/server/routine-command-actor";
import { enforceAuthenticatedMutationRateLimit } from "@/lib/security/mutation-rate-limit";
import {
    readRoutineJsonBody,
    routineErrorResponse,
    routineFeatureGuard,
    routineRequestSizeGuard,
} from "@/lib/server/routine-api";
import {
    createRoutineTask,
    getRoutineTasks,
} from "@/lib/services/routine";
import {
    routineTaskCreateSchema,
    routineTaskFiltersSchema,
} from "@/lib/validations/routine";

export async function GET(request: NextRequest): Promise<NextResponse> {
    const featureResponse = routineFeatureGuard();
    if (featureResponse) return featureResponse;

    try {
        const auth = await requireAdminSession();
        if (!auth.ok) return auth.response;
        const params = request.nextUrl.searchParams;
        const parsed = routineTaskFiltersSchema.safeParse({
            activeOnly: params.get("activeOnly") ?? undefined,
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
        return NextResponse.json(await getRoutineTasks(parsed.data));
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
        const auth = await requireAdminSession();
        if (!auth.ok) return auth.response;
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
        const task = await createRoutineTask(parsed.data, actor);
        return NextResponse.json({ task }, { status: 201 });
    } catch (error) {
        return routineErrorResponse(error, "Error creating routine task");
    }
}
