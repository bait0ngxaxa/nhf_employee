import type { LineFlexMessage } from "@/types/api";

import { buildITTicketLiffUrl } from "../../application/liff-links";
import type { ITTicketRequesterLineNotificationPayload } from "../../domain/ticket-notification";

type ITRequesterLineEvent = ITTicketRequesterLineNotificationPayload["event"];

interface ITTicketLineCopy {
    readonly title: string;
    readonly body: string;
    readonly actionLabel: string;
    readonly accentColor: string;
}

const IT_TICKET_LINE_COPY: Record<ITRequesterLineEvent, ITTicketLineCopy> = {
    OPERATOR_COMMENTED: {
        title: "IT ตอบกลับคำขอของคุณ",
        body: "มีข้อความตอบกลับใหม่",
        actionLabel: "เปิด Ticket",
        accentColor: "#2563EB",
    },
    WAITING_REQUESTER: {
        title: "IT ต้องการข้อมูลเพิ่มเติม",
        body: "รอข้อมูลเพิ่มเติมจากคุณ",
        actionLabel: "ตอบกลับ",
        accentColor: "#D97706",
    },
    RESOLVED: {
        title: "คำขอ IT ได้รับการแก้ไขแล้ว",
        body: "ได้รับการแก้ไขแล้ว",
        actionLabel: "ดูรายละเอียด",
        accentColor: "#047857",
    },
};

export function buildITTicketLineFlexMessage(
    payload: ITTicketRequesterLineNotificationPayload,
): LineFlexMessage {
    const copy = IT_TICKET_LINE_COPY[payload.event];
    const ticketLabel = `Ticket IT #${payload.ticketId}`;

    return {
        type: "flex",
        altText: `${copy.title} · ${ticketLabel}`,
        contents: {
            type: "bubble",
            header: {
                type: "box",
                layout: "vertical",
                paddingAll: "20px",
                backgroundColor: copy.accentColor,
                contents: [{
                    type: "text",
                    text: copy.title,
                    color: "#FFFFFF",
                    size: "lg",
                    weight: "bold",
                    wrap: true,
                }],
            },
            body: {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [
                    {
                        type: "text",
                        text: ticketLabel,
                        size: "md",
                        weight: "bold",
                        wrap: true,
                    },
                    {
                        type: "text",
                        text: `${ticketLabel} ${copy.body}`,
                        color: "#4B5563",
                        size: "sm",
                        wrap: true,
                    },
                ],
            },
            footer: {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [{
                    type: "button",
                    style: "primary",
                    height: "sm",
                    color: copy.accentColor,
                    action: {
                        type: "uri",
                        label: copy.actionLabel,
                        uri: buildITTicketLiffUrl(payload.ticketId),
                    },
                }],
            },
        },
    };
}
