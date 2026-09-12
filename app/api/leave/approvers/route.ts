import { NextResponse } from "next/server";

import { requireActiveWorkforceOrAdminSession } from "@/lib/auth/workforce";
import { WorkforceAuthorizationError } from "@/lib/auth/workforce-transaction";
import {
    assertLeaveCapabilityForMigration,
    buildLeaveAuthorizationContext,
    ApproverAssignmentError,
    assignLeaveApprovers,
    getLeaveApproverEmployees,
    LeaveCapabilityDeniedError,
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

        const auth = await requireActiveWorkforceOrAdminSession();
        if (!auth.ok) {
            return auth.response.status === 401 ? forbidden() : auth.response;
        }

        await assertLeaveCapabilityForMigration(
            buildLeaveAuthorizationContext(
                auth.user,
                "employeeId" in auth ? auth.employeeId : null,
                "DASHBOARD",
            ),
            "leave.approver.manage",
        );

        const employees = await getLeaveApproverEmployees();

        return NextResponse.json({ employees });
    } catch (error) {
        if (error instanceof LeaveCapabilityDeniedError) {
            return forbidden();
        }
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

        const auth = await requireActiveWorkforceOrAdminSession();
        if (!auth.ok) {
            return auth.response.status === 401 ? forbidden() : auth.response;
        }

        const authorization = buildLeaveAuthorizationContext(
            auth.user,
            "employeeId" in auth ? auth.employeeId : null,
            "DASHBOARD",
        );
        await assertLeaveCapabilityForMigration(
            authorization,
            "leave.approver.manage",
        );

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
            authorization,
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
        if (error instanceof LeaveCapabilityDeniedError) {
            return forbidden();
        }
        if (error instanceof WorkforceAuthorizationError) {
            return forbidden();
        }
        console.error("Error updating approvers:", error);
        return NextResponse.json(
            { error: COMMON_API_MESSAGES.failedToUpdateApprovers },
            { status: 500 },
        );
    }
}
