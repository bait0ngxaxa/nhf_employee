import { emailService } from "@/lib/email";
import { type LeaveActionPayload, type LeaveResultPayload } from "@/lib/email/types";
import { signLeaveToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/prisma";

/**
 * Send notification to the manager when an employee requests leave.
 */
export async function sendLeaveActionNotifications(
    leaveRequestPayload: LeaveActionPayload
): Promise<void> {
    const manager = await prisma.employee.findUnique({
        where: { id: leaveRequestPayload.managerId },
    });

    if (!manager || !manager.email) {
        throw new Error("Manager or manager email not found");
    }

    // Generate Magic Link Tokens for Approve and Reject
    const approveToken = await signLeaveToken({
        leaveId: leaveRequestPayload.leaveId,
        approverId: manager.id,
        action: "approve",
    });

    const rejectToken = await signLeaveToken({
        leaveId: leaveRequestPayload.leaveId,
        approverId: manager.id,
        action: "reject",
    });

    // PUBLIC_APPROVE_URL = Cloudflare Tunnel domain (accessible outside LAN)
    // Falls back to NEXTAUTH_URL for dev / non-tunnel setups
    const publicBase = process.env.PUBLIC_APPROVE_URL || process.env.NEXTAUTH_URL;
    const approveLink = `${publicBase}/leave/action?token=${approveToken}`;
    const rejectLink = `${publicBase}/leave/action?token=${rejectToken}`;

    await emailService.sendLeaveActionNotification(
        manager.email,
        leaveRequestPayload,
        approveLink,
        rejectLink
    );
}

/**
 * Send notification to the employee when their manager approves/rejects the leave.
 */
export async function sendLeaveResultNotifications(
    leaveResultPayload: LeaveResultPayload
): Promise<void> {
    if (!leaveResultPayload.employeeEmail) {
        throw new Error("Employee email not found in payload");
    }

    await emailService.sendLeaveResultNotification(
        leaveResultPayload.employeeEmail,
        leaveResultPayload
    );
}
