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

const LEAVE_EMAIL_FROM_NAME = "ระบบลา NHFapp";

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
    return sendEmail({ ...emailData, fromName: LEAVE_EMAIL_FROM_NAME });
}

export async function sendLeaveActionNotification(
    data: LeaveActionPayload,
    dashboardLink: string,
): Promise<boolean> {
    const emailData: EmailData = {
        to: data.approver.email,
        subject: `[NHF Leave] คำขอลาใหม่จาก ${data.employee.name}`,
        html: generateLeaveActionEmailHTML(data, dashboardLink),
        text: `มีคำขอลาใหม่\nพนักงาน ${data.employee.name} ขอลา ${data.durationDays} วัน\nดูรายละเอียด: ${dashboardLink}`,
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
        subject: `[NHF Leave] ผลการพิจารณาคำขอลา: ${data.status === "APPROVED" ? "อนุมัติ" : "ไม่อนุมัติ"}`,
        html: generateLeaveResultEmailHTML(data, dashboardUrl),
        text: `ผลการพิจารณาคำขอลา: ${data.status}\nเหตุผล: ${data.reason || "-"}`,
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
        subject: `[NHF Leave] ${data.employee.name} ยกเลิกคำขอลาแล้ว`,
        html: generateLeaveEventEmailHTML({
            ...data,
            title: "คำขอลาถูกยกเลิก",
            intro: `${data.employee.name} ยกเลิกคำขอลาที่รออนุมัติแล้ว`,
            employeeName: data.employee.name,
            dashboardLink,
            ctaLabel: "ดูรายการอนุมัติ",
        }),
        text: `${data.employee.name} ยกเลิกคำขอลาแล้ว\nดูรายละเอียด: ${dashboardLink}`,
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
        subject: `[NHF Leave] มีคำขอยกเลิกวันลาจาก ${data.employee.name}`,
        html: generateLeaveEventEmailHTML({
            ...data,
            title: "มีคำขอยกเลิกวันลารอยืนยัน",
            intro: `${data.employee.name} ขอยกเลิก${getLeaveTypeLabel(data.leaveType)}ที่อนุมัติแล้ว`,
            employeeName: data.employee.name,
            dashboardLink,
            ctaLabel: "ตรวจสอบและยืนยัน",
            noteLabel: "เหตุผลการขอยกเลิก",
            note: data.note,
        }),
        text: `${data.employee.name} ขอยกเลิกคำขอลาที่อนุมัติแล้ว\nดูรายละเอียด: ${dashboardLink}`,
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
        subject: "[NHF Leave] ยกเลิกวันลาที่อนุมัติแล้วเรียบร้อย",
        html: generateLeaveEventEmailHTML({
            ...data,
            title: "ยกเลิกวันลาที่อนุมัติแล้วเรียบร้อย",
            intro: `${decisionActor} ยืนยันการยกเลิกวันลาที่อนุมัติแล้ว`,
            employeeName: data.employee.name,
            dashboardLink,
            ctaLabel: "ดูประวัติการลา",
            actorLabel: "ผู้ยืนยัน",
            actorName: decisionActor,
        }),
        text: `${decisionActor} ยืนยันการยกเลิกวันลาที่อนุมัติแล้วเรียบร้อย\nดูรายละเอียด: ${dashboardLink}`,
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
        subject: "[NHF Leave] มีรายการแจ้งไม่ได้ใช้วันลารอยืนยัน",
        html: generateLeaveEventEmailHTML({
            ...data,
            title: "มีรายการแจ้งไม่ได้ใช้วันลารอยืนยัน",
            intro: `${data.employee.name} แจ้งว่าไม่ได้ใช้วันลาที่อนุมัติแล้ว`,
            employeeName: data.employee.name,
            dashboardLink,
            ctaLabel: "ตรวจสอบและยืนยัน",
            noteLabel: "โน๊ตจากพนักงาน",
            note: data.note,
        }),
        text: `${data.employee.name} แจ้งไม่ได้ใช้วันลา\nดูรายละเอียด: ${dashboardLink}`,
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
        subject: "[NHF Leave] ยืนยันไม่ได้ใช้วันลาแล้ว",
        html: generateLeaveEventEmailHTML({
            ...data,
            title: "ยืนยันไม่ได้ใช้วันลาแล้ว",
            intro: `${decisionActor} ยืนยันว่าคุณไม่ได้ใช้วันลาตามคำขอนี้แล้ว`,
            employeeName: data.employee.name,
            dashboardLink,
            ctaLabel: "ดูประวัติการลา",
            actorLabel: "ผู้ยืนยัน",
            actorName: decisionActor,
        }),
        text: `${decisionActor} ยืนยันไม่ได้ใช้วันลาแล้ว\nดูรายละเอียด: ${dashboardLink}`,
        messageId: buildLeaveMessageId("not-taken-confirmed", data.leaveId),
    };

    return sendLeaveEmail(emailData);
}
