import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth/api";
import {
    ApproverAssignmentError,
    assignLeaveApprovers,
    getLeaveApproverEmployees,
    leaveApproverAssignmentsSchema,
} from "@/modules/leave";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import { forbidden, notFound } from "@/lib/ssot/http";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";

export async function GET(): Promise<NextResponse> {
    try {
        if (!isFeatureEnabled(FEATURE_KEYS.leave)) {
            return notFound();
        }

        const auth = await requireAdminSession({
            unauthorizedResponse: () => forbidden(),
        });
        if (!auth.ok) return auth.response;

        const employees = await getLeaveApproverEmployees();

        return NextResponse.json({ employees });
    } catch (error) {
        console.error("Error fetching approver data:", error);
        return NextResponse.json(
            { error: COMMON_API_MESSAGES.failedToFetchApproverData },
            { status: 500 },
        );
    }
}

export async function PUT(req: Request): Promise<NextResponse> {
    try {
        if (!isFeatureEnabled(FEATURE_KEYS.leave)) {
            return notFound();
        }

        const auth = await requireAdminSession({
            unauthorizedResponse: () => forbidden(),
        });
        if (!auth.ok) return auth.response;

        const body = await req.json();
        const parsed = leaveApproverAssignmentsSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                { error: COMMON_API_MESSAGES.invalidInput, details: parsed.error.format() },
                { status: 400 },
            );
        }

        await assignLeaveApprovers(parsed.data.assignments, {
            userId: auth.user.id,
            email: auth.user.email,
        });

        return NextResponse.json({
            success: true,
            message: COMMON_API_MESSAGES.operationCompleted,
        });
    } catch (error) {
        if (error instanceof ApproverAssignmentError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.statusCode },
            );
        }
        console.error("Error updating approvers:", error);
        return NextResponse.json(
            { error: COMMON_API_MESSAGES.failedToUpdateApprovers },
            { status: 500 },
        );
    }
}
