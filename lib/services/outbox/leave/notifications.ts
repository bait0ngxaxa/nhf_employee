import { emailService } from "@/lib/email";
import { type LeaveActionPayload, type LeaveResultPayload } from "@/lib/email/types";
import { prisma } from "@/lib/prisma";
import {
    APP_DASHBOARD_TABS,
    toDashboardTabPath,
} from "@/lib/ssot/routes";

const LEAVE_TYPE_LABELS: Record<string, string> = {
    SICK: "ลาป่วย",
    PERSONAL: "ลากิจ",
    VACATION: "ลาพักร้อน",
};

/**
 * Send notification to the manager when an employee requests leave.
 * Creates both an email and an in-app notification.
 */
export async function sendLeaveActionNotifications(
    leaveRequestPayload: LeaveActionPayload,
): Promise<void> {
    const manager = await prisma.employee.findUnique({
        where: { id: leaveRequestPayload.managerId },
        select: { email: true, user: { select: { id: true } } },
    });

    if (!manager || !manager.email) {
        throw new Error("Manager or manager email not found");
    }

    // PUBLIC_APPROVE_URL = Cloudflare Tunnel domain (accessible outside LAN)
    // Falls back to NEXTAUTH_URL for dev / non-tunnel setups
    const publicBase = process.env.PUBLIC_APPROVE_URL || process.env.NEXTAUTH_URL;
    const dashboardLink = `${publicBase}${toDashboardTabPath(APP_DASHBOARD_TABS.managerApproval)}`;

    await emailService.sendLeaveActionNotification(manager.email, leaveRequestPayload, dashboardLink);

    if (manager.user?.id) {
        const typeLabel = LEAVE_TYPE_LABELS[leaveRequestPayload.leaveType] ?? "ลา";
        await prisma.notification.create({
            data: {
                userId: manager.user.id,
                type: "LEAVE_REQUESTED",
                title: "คำขออนุมัติลางานใหม่",
                message: `${leaveRequestPayload.employeeName} ขออนุมัติ${typeLabel} ${leaveRequestPayload.durationDays} วัน (${leaveRequestPayload.startDate} - ${leaveRequestPayload.endDate})`,
                actionUrl: toDashboardTabPath(APP_DASHBOARD_TABS.managerApproval),
                referenceId: leaveRequestPayload.leaveId,
            },
        });
    }
}

/**
 * Send notification to the employee when their manager approves/rejects the leave.
 * Creates both an email and an in-app notification.
 */
export async function sendLeaveResultNotifications(
    leaveResultPayload: LeaveResultPayload,
): Promise<void> {
    if (!leaveResultPayload.employeeEmail) {
        throw new Error("Employee email not found in payload");
    }

    await emailService.sendLeaveResultNotification(
        leaveResultPayload.employeeEmail,
        leaveResultPayload,
    );

    const employeeUser = await prisma.user.findFirst({
        where: { employeeId: leaveResultPayload.employeeId },
        select: { id: true },
    });

    if (employeeUser) {
        const isApproved = leaveResultPayload.status === "APPROVED";
        await prisma.notification.create({
            data: {
                userId: employeeUser.id,
                type: isApproved ? "LEAVE_APPROVED" : "LEAVE_REJECTED",
                title: isApproved ? "ใบลาได้รับการอนุมัติ" : "ใบลาไม่ได้รับการอนุมัติ",
                message: isApproved
                    ? "ผู้อนุมัติได้อนุมัติคำขอลางานของคุณแล้ว"
                    : `ผู้อนุมัติไม่อนุมัติคำขอลางานของคุณ${leaveResultPayload.reason ? `: ${leaveResultPayload.reason}` : ""}`,
                actionUrl: toDashboardTabPath(APP_DASHBOARD_TABS.leaveHistory),
                referenceId: leaveResultPayload.leaveId,
            },
        });
    }
}
