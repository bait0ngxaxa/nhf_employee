import type { ITTicketNotificationPayloadV1 } from "./ticket-notification";
import { NOTIFICATION_ACTIONS } from "@/shared/notifications/presentation";

const TICKET_COPY = {
    CREATED: { title: "มี Ticket IT ใหม่", summary: "รอรับเรื่องในคิว IT", color: "#2563EB" },
    ASSIGNED: { title: "คุณได้รับมอบหมาย Ticket IT", summary: "อยู่ในความรับผิดชอบของคุณ", color: "#2563EB" },
    OPERATOR_COMMENTED: { title: "IT ตอบกลับ Ticket ของคุณ", summary: "มีข้อความตอบกลับใหม่จาก IT", color: "#2563EB" },
    REQUESTER_COMMENTED: { title: "ผู้ขอส่งข้อความใหม่ใน Ticket IT", summary: "มีข้อความใหม่จากผู้ขอ", color: "#7C3AED" },
    WAITING_REQUESTER: { title: "Ticket IT รอข้อมูลเพิ่มเติมจากคุณ", summary: "กรุณาให้ข้อมูลเพิ่มเติมเพื่อให้ IT ดำเนินการต่อ", color: "#B45309" },
    RESOLVED: { title: "Ticket IT ได้รับการแก้ไขแล้ว", summary: "ตรวจสอบผลการแก้ไขได้ในรายละเอียด Ticket", color: "#047857" },
} as const;

export function getITTicketNotificationContent(payload: Pick<ITTicketNotificationPayloadV1, "event" | "ticketId">): {
    readonly title: string;
    readonly summary: string;
    readonly reference: string;
    readonly actionLabel: string;
    readonly accentColor: string;
} {
    const copy = TICKET_COPY[payload.event];
    return { title: copy.title, summary: copy.summary, reference: `Ticket IT #${payload.ticketId}`,
        actionLabel: NOTIFICATION_ACTIONS.ticket, accentColor: copy.color };
}
