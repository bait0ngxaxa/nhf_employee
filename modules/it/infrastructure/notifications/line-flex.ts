import type { LineFlexMessage } from "@/types/api";
import { getPublicOrigin } from "@/lib/network/public-url";
import { APP_ROUTES } from "@/lib/ssot/routes";

import { buildITTicketLiffUrl } from "../../application/liff-links";
import type { ITTicketLineNotificationPayload } from "../../domain/ticket-notification";

interface ITTicketLineCopy {
    readonly title: string;
    readonly body: string;
    readonly actionLabel: string;
    readonly accentColor: string;
}

const IT_TICKET_LINE_COPY: Record<ITTicketLineNotificationPayload["event"], ITTicketLineCopy> = {
    CREATED: {
        title: "มี Ticket IT ใหม่",
        body: "มีคำขอ IT ใหม่รอรับเรื่อง",
        actionLabel: "เปิดคิว IT",
        accentColor: "#2563EB",
    },
    ASSIGNED: {
        title: "คุณได้รับมอบหมาย Ticket IT",
        body: "มี Ticket IT มอบหมายให้คุณ",
        actionLabel: "เปิด Ticket",
        accentColor: "#2563EB",
    },
    OPERATOR_COMMENTED: {
        title: "IT ตอบกลับคำขอของคุณ",
        body: "มีข้อความตอบกลับใหม่",
        actionLabel: "เปิด Ticket",
        accentColor: "#2563EB",
    },
    REQUESTER_COMMENTED: {
        title: "ผู้ขอส่งข้อความใหม่ใน Ticket IT",
        body: "มีข้อความใหม่จากผู้ขอ",
        actionLabel: "เปิด Ticket",
        accentColor: "#7C3AED",
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

function getActionUrl(payload: ITTicketLineNotificationPayload): string {
    if (payload.audience === "REQUESTER") {
        return buildITTicketLiffUrl(payload.ticketId);
    }

    return new URL(
        `${APP_ROUTES.dashboardITQueue}/${payload.ticketId}`,
        getPublicOrigin(),
    ).toString();
}

export function buildITTicketLineFlexMessage(
    payload: ITTicketLineNotificationPayload,
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
                        text: copy.body,
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
                        uri: getActionUrl(payload),
                    },
                }],
            },
        },
    };
}
