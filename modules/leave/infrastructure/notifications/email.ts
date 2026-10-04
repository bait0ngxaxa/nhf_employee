import { NOTIFICATION_ACTIONS, NOTIFICATION_FOOTER, NOTIFICATION_MODULES, notificationSubject } from "@/shared/notifications/presentation";
import { LEAVE_NOTIFICATION_TITLES } from "../../domain/notification-content";
import type { EmailData } from "@/lib/email/types";
import { sendEmail } from "@/lib/email/transport";
import { getPublicOrigin } from "@/lib/network/public-url";
import {
    APP_DASHBOARD_TABS,
    toDashboardMenuPath,
} from "@/lib/ssot/routes";
import {
    formatLeaveDecisionActor,
    getLeaveTypeLabel,
} from "@/modules/leave/application/notifications/notification-format";
import type {
    LeaveActionPayload,
    LeaveCancelledAfterApprovalPayload,
    LeaveCancelledPayload,
    LeaveCancellationRequestedPayload,
    LeaveNotTakenConfirmedPayload,
    LeaveNotTakenRequestedPayload,
    LeaveResultPayload,
} from "@/modules/leave/application/notifications/notification-payloads";
import { generateLeaveActionEmailHTML } from "@/modules/leave/infrastructure/notifications/email-templates/leave-action";
import { generateLeaveEventEmailHTML } from "@/modules/leave/infrastructure/notifications/email-templates/leave-event";
import { generateLeaveResultEmailHTML } from "@/modules/leave/infrastructure/notifications/email-templates/leave-result";

const LEAVE_EMAIL_FROM_NAME = NOTIFICATION_MODULES.Leave.sender;

type LeaveEmailEvent =
    | "action"
    | "result"
    | "cancelled"
    | "cancellation-requested"
    | "cancelled-after-approval"
    | "not-taken-requested"
    | "not-taken-confirmed";

function buildLeaveMessageId(
    event: LeaveEmailEvent,
    leaveId: string,
    recipientIdentity?: string,
): string {
    const safeLeaveId = leaveId.replace(/[^a-zA-Z0-9._-]/g, "-");
    const safeRecipient = recipientIdentity?.replace(/[^a-zA-Z0-9._-]/g, "-");
    const recipientPart = safeRecipient ? `-${safeRecipient}` : "";
    return `<nhf-leave-${event}-${safeLeaveId}${recipientPart}@notifications.thainhf.org>`;
}

function sendLeaveEmail(emailData: EmailData): Promise<boolean> {
    return sendEmail({ ...emailData, text: `${emailData.text ?? ""}\n\n${NOTIFICATION_FOOTER}`, fromName: LEAVE_EMAIL_FROM_NAME });
}

export async function sendLeaveActionNotification(
    data: LeaveActionPayload,
    dashboardLink: string,
): Promise<boolean> {
    const emailData: EmailData = {
        to: data.approver.email,
        subject: notificationSubject("Leave", LEAVE_NOTIFICATION_TITLES.action),
        html: generateLeaveActionEmailHTML(data, dashboardLink),
        text: `${LEAVE_NOTIFICATION_TITLES.action}\nพนักงาน ${data.employee.name} ขอลา ${data.durationDays} วัน\nตรวจสอบคำขอ: ${dashboardLink}`,
        messageId: buildLeaveMessageId(
            "action",
            data.leaveId,
            String(data.approver.userId),
        ),
    };

    return await sendLeaveEmail(emailData);
}

export async function sendLeaveResultNotification(
    data: LeaveResultPayload,
): Promise<boolean> {
    const dashboardUrl = `${getPublicOrigin()}${toDashboardMenuPath(APP_DASHBOARD_TABS.leaveHistory)}`;
    const emailData: EmailData = {
        to: data.employee.email,
        subject: notificationSubject("Leave", data.status === "APPROVED" ? LEAVE_NOTIFICATION_TITLES.approved : LEAVE_NOTIFICATION_TITLES.rejected),
        html: generateLeaveResultEmailHTML(data, dashboardUrl),
        text: `${data.status === "APPROVED" ? LEAVE_NOTIFICATION_TITLES.approved : LEAVE_NOTIFICATION_TITLES.rejected}\nเหตุผล: ${data.reason || "-"}\nเปิดรายละเอียด: ${dashboardUrl}`,
        messageId: buildLeaveMessageId("result", data.leaveId),
    };

    return await sendLeaveEmail(emailData);
}

export async function sendLeaveCancelledNotification(
    data: LeaveCancelledPayload,
): Promise<boolean> {
    const dashboardLink = `${getPublicOrigin()}${toDashboardMenuPath(APP_DASHBOARD_TABS.managerApproval)}`;
    const emailData: EmailData = {
        to: data.approver.email,
        subject: notificationSubject("Leave", LEAVE_NOTIFICATION_TITLES.cancelled),
        html: generateLeaveEventEmailHTML({
            ...data,
            title: LEAVE_NOTIFICATION_TITLES.cancelled,
            intro: `${data.employee.name} ยกเลิกคำขอลาที่รออนุมัติแล้ว`,
            employeeName: data.employee.name,
            dashboardLink,
            ctaLabel: NOTIFICATION_ACTIONS.details,
        }),
        text: `${LEAVE_NOTIFICATION_TITLES.cancelled}\n${data.employee.name} ยกเลิกคำขอลาแล้ว\nเปิดรายละเอียด: ${dashboardLink}`,
        messageId: buildLeaveMessageId("cancelled", data.leaveId),
    };

    return sendLeaveEmail(emailData);
}

export async function sendLeaveCancellationRequestedNotification(
    data: LeaveCancellationRequestedPayload,
): Promise<boolean> {
    const dashboardLink = `${getPublicOrigin()}${toDashboardMenuPath(APP_DASHBOARD_TABS.managerApproval)}`;
    const emailData: EmailData = {
        to: data.approver.email,
        subject: notificationSubject("Leave", LEAVE_NOTIFICATION_TITLES.cancellationRequested),
        html: generateLeaveEventEmailHTML({
            ...data,
            title: LEAVE_NOTIFICATION_TITLES.cancellationRequested,
            intro: `${data.employee.name} ขอยกเลิก${getLeaveTypeLabel(data.leaveType)}ที่อนุมัติแล้ว`,
            employeeName: data.employee.name,
            dashboardLink,
            ctaLabel: NOTIFICATION_ACTIONS.review,
            noteLabel: "เหตุผลการขอยกเลิก",
            note: data.note,
        }),
        text: `${LEAVE_NOTIFICATION_TITLES.cancellationRequested}\n${data.employee.name} ขอยกเลิกคำขอลาที่อนุมัติแล้ว\nตรวจสอบคำขอ: ${dashboardLink}`,
        messageId: buildLeaveMessageId(
            "cancellation-requested",
            data.leaveId,
            String(data.approver.userId),
        ),
    };

    return sendLeaveEmail(emailData);
}

export async function sendLeaveCancelledAfterApprovalNotification(
    data: LeaveCancelledAfterApprovalPayload,
): Promise<boolean> {
    const dashboardLink = `${getPublicOrigin()}${toDashboardMenuPath(APP_DASHBOARD_TABS.leaveHistory)}`;
    const decisionActor = formatLeaveDecisionActor(data);
    const emailData: EmailData = {
        to: data.employee.email,
        subject: notificationSubject("Leave", LEAVE_NOTIFICATION_TITLES.cancelledAfterApproval),
        html: generateLeaveEventEmailHTML({
            ...data,
            title: LEAVE_NOTIFICATION_TITLES.cancelledAfterApproval,
            intro: `${decisionActor} ยืนยันการยกเลิกวันลาที่อนุมัติแล้ว`,
            employeeName: data.employee.name,
            dashboardLink,
            ctaLabel: NOTIFICATION_ACTIONS.details,
            actorLabel: "ผู้ยืนยัน",
            actorName: decisionActor,
        }),
        text: `${decisionActor} ยืนยันการยกเลิกวันลาที่อนุมัติแล้วเรียบร้อย\nเปิดรายละเอียด: ${dashboardLink}`,
        messageId: buildLeaveMessageId(
            "cancelled-after-approval",
            data.leaveId,
        ),
    };

    return sendLeaveEmail(emailData);
}

export async function sendLeaveNotTakenRequestedNotification(
    data: LeaveNotTakenRequestedPayload,
): Promise<boolean> {
    const dashboardLink = `${getPublicOrigin()}${toDashboardMenuPath(APP_DASHBOARD_TABS.managerApproval)}`;
    const emailData: EmailData = {
        to: data.approver.email,
        subject: notificationSubject("Leave", LEAVE_NOTIFICATION_TITLES.notTakenRequested),
        html: generateLeaveEventEmailHTML({
            ...data,
            title: LEAVE_NOTIFICATION_TITLES.notTakenRequested,
            intro: `${data.employee.name} แจ้งว่าไม่ได้ใช้วันลาที่อนุมัติแล้ว`,
            employeeName: data.employee.name,
            dashboardLink,
            ctaLabel: NOTIFICATION_ACTIONS.review,
            noteLabel: "หมายเหตุจากพนักงาน",
            note: data.note,
        }),
        text: `${LEAVE_NOTIFICATION_TITLES.notTakenRequested}\n${data.employee.name} แจ้งไม่ได้ใช้วันลา\nตรวจสอบคำขอ: ${dashboardLink}`,
        messageId: buildLeaveMessageId("not-taken-requested", data.leaveId),
    };

    return sendLeaveEmail(emailData);
}

export async function sendLeaveNotTakenConfirmedNotification(
    data: LeaveNotTakenConfirmedPayload,
): Promise<boolean> {
    const dashboardLink = `${getPublicOrigin()}${toDashboardMenuPath(APP_DASHBOARD_TABS.leaveHistory)}`;
    const decisionActor = formatLeaveDecisionActor(data);
    const emailData: EmailData = {
        to: data.employee.email,
        subject: notificationSubject("Leave", LEAVE_NOTIFICATION_TITLES.notTakenConfirmed),
        html: generateLeaveEventEmailHTML({
            ...data,
            title: LEAVE_NOTIFICATION_TITLES.notTakenConfirmed,
            intro: `${decisionActor} ยืนยันว่าคุณไม่ได้ใช้วันลาตามคำขอนี้แล้ว`,
            employeeName: data.employee.name,
            dashboardLink,
            ctaLabel: NOTIFICATION_ACTIONS.details,
            actorLabel: "ผู้ยืนยัน",
            actorName: decisionActor,
        }),
        text: `${decisionActor} ยืนยันไม่ได้ใช้วันลาแล้ว\nเปิดรายละเอียด: ${dashboardLink}`,
        messageId: buildLeaveMessageId("not-taken-confirmed", data.leaveId),
    };

    return sendLeaveEmail(emailData);
}
