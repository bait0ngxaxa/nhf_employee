import type { ITTicketNotificationPayloadV1 } from "./ticket-notification";

const TICKET_COPY = {
    CREATED: { title: "มี Ticket IT ใหม่", summary: "รอรับเรื่องในคิว IT" },
    ASSIGNED: { title: "คุณได้รับมอบหมาย Ticket IT", summary: "อยู่ในความรับผิดชอบของคุณ" },
    OPERATOR_COMMENTED: { title: "IT ตอบกลับ Ticket ของคุณ", summary: "มีข้อความตอบกลับใหม่จาก IT" },
    REQUESTER_COMMENTED: { title: "ผู้ขอส่งข้อความใหม่ใน Ticket IT", summary: "มีข้อความใหม่จากผู้ขอ" },
    WAITING_REQUESTER: { title: "Ticket IT รอข้อมูลเพิ่มเติมจากคุณ", summary: "กรุณาให้ข้อมูลเพิ่มเติมเพื่อให้ IT ดำเนินการต่อ" },
    RESOLVED: { title: "Ticket IT ได้รับการแก้ไขแล้ว", summary: "ตรวจสอบผลการแก้ไขได้ในรายละเอียด Ticket" },
} as const;

export function getITTicketNotificationContent(payload: Pick<ITTicketNotificationPayloadV1, "event" | "ticketId">): {
    readonly title: string;
    readonly summary: string;
    readonly reference: string;
} {
    const copy = TICKET_COPY[payload.event];
    return { title: copy.title, summary: copy.summary, reference: `Ticket IT #${payload.ticketId}` };
}
