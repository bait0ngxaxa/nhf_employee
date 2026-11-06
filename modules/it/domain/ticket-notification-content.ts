import type { ITTicketNotificationPayloadV1 } from "./ticket-notification";

const TICKET_COPY = {
    CREATED: { title: "มี Ticket IT ใหม่", summary: "รอรับเรื่องในคิว IT" },
    ASSIGNED: { title: "คุณได้รับมอบหมาย Ticket IT", summary: "อยู่ในความรับผิดชอบของคุณ" },
    OPERATOR_COMMENTED: { title: "IT ตอบกลับ Ticket ของคุณ", summary: "มีข้อความตอบกลับใหม่จาก IT" },
    REQUESTER_COMMENTED: { title: "ผู้ขอส่งข้อความใหม่ใน Ticket IT", summary: "มีข้อความใหม่จากผู้ขอ" },
    WAITING_REQUESTER: { title: "Ticket IT รอข้อมูลเพิ่มเติมจากคุณ", summary: "กรุณาให้ข้อมูลเพิ่มเติมเพื่อให้ IT ดำเนินการต่อ" },
    RESOLVED: { title: "Ticket IT ได้รับการแก้ไขแล้ว", summary: "ตรวจสอบผลการแก้ไขได้ในรายละเอียด Ticket" },
    PRIORITY_ESCALATED: { title: "Ticket IT ถูกยกระดับความสำคัญ", summary: "Priority เพิ่มขึ้น" },
} as const;

export function getITTicketNotificationContent(payload: Pick<ITTicketNotificationPayloadV1, "event" | "ticketId" | "priority">): {
    readonly title: string;
    readonly summary: string;
    readonly reference: string;
} {
    const copy = TICKET_COPY[payload.event];
    if (payload.event === "PRIORITY_ESCALATED" && payload.priority === undefined) {
        throw new Error("Priority escalation notification is missing its priority");
    }
    const summary = payload.event === "PRIORITY_ESCALATED"
        ? `${copy.summary}: ${payload.priority}`
        : copy.summary;
    return { title: copy.title, summary, reference: `Ticket IT #${payload.ticketId}` };
}
