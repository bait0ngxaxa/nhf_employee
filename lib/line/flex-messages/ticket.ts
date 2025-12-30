import { LineNotificationData, LineFlexMessage } from "@/types/api";
import {
    getTicketCategoryLabel,
    getTicketPriorityLabel,
    getTicketStatusLabel,
} from "@/lib/helpers/ticket-helpers";
import { getPriorityEmoji, getPriorityColor, formatDate } from "../helpers";

export function generateTicketFlexMessage(
    data: LineNotificationData,
    type: "new_ticket" | "status_update" | "it_team",
    baseUrl: string
): LineFlexMessage {
    const priorityColor = getPriorityColor(data.priority);
    const categoryEmoji = data.category === "URGENT" ? "🚨" : "🎫";

    let headerText = "";
    let headerColor = "";

    switch (type) {
        case "new_ticket":
            headerText = "Ticket ใหม่ถูกสร้าง";
            headerColor = "#3B82F6";
            break;
        case "status_update":
            headerText = "อัพเดทสถานะ Ticket";
            headerColor = "#10B981";
            break;
        case "it_team":
            headerText = "Ticket ความสำคัญสูง";
            headerColor = "#EF4444";
            break;
    }

    return {
        type: "flex",
        altText: `${headerText} #${data.ticketId}`,
        contents: {
            type: "bubble",
            header: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: `${categoryEmoji} ${headerText}`,
                        weight: "bold",
                        color: "#FFFFFF",
                        size: "lg",
                    },
                    {
                        type: "text",
                        text: `Ticket #${data.ticketId}`,
                        color: "#FFFFFF",
                        size: "sm",
                    },
                ],
                backgroundColor: headerColor,
                paddingAll: "20px",
            },
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: data.title,
                        weight: "bold",
                        size: "lg",
                        wrap: true,
                    },
                    {
                        type: "separator",
                        margin: "md",
                    },
                    {
                        type: "box",
                        layout: "vertical",
                        margin: "md",
                        spacing: "sm",
                        contents: [
                            {
                                type: "box",
                                layout: "baseline",
                                spacing: "sm",
                                contents: [
                                    {
                                        type: "text",
                                        text: "หมวดหมู่:",
                                        color: "#666666",
                                        size: "sm",
                                        flex: 2,
                                    },
                                    {
                                        type: "text",
                                        text: getTicketCategoryLabel(
                                            data.category
                                        ),
                                        wrap: true,
                                        color: "#333333",
                                        size: "sm",
                                        flex: 3,
                                    },
                                ],
                            },
                            {
                                type: "box",
                                layout: "baseline",
                                spacing: "sm",
                                contents: [
                                    {
                                        type: "text",
                                        text: "ความสำคัญ:",
                                        color: "#666666",
                                        size: "sm",
                                        flex: 2,
                                    },
                                    {
                                        type: "text",
                                        text: `${getPriorityEmoji(
                                            data.priority
                                        )} ${getTicketPriorityLabel(
                                            data.priority
                                        )}`,
                                        wrap: true,
                                        color: priorityColor,
                                        size: "sm",
                                        weight: "bold",
                                        flex: 3,
                                    },
                                ],
                            },
                            {
                                type: "box",
                                layout: "baseline",
                                spacing: "sm",
                                contents: [
                                    {
                                        type: "text",
                                        text: "สถานะ:",
                                        color: "#666666",
                                        size: "sm",
                                        flex: 2,
                                    },
                                    {
                                        type: "text",
                                        text: getTicketStatusLabel(data.status),
                                        wrap: true,
                                        color: "#333333",
                                        size: "sm",
                                        flex: 3,
                                    },
                                ],
                            },
                            {
                                type: "box",
                                layout: "baseline",
                                spacing: "sm",
                                contents: [
                                    {
                                        type: "text",
                                        text: "ผู้แจ้ง:",
                                        color: "#666666",
                                        size: "sm",
                                        flex: 2,
                                    },
                                    {
                                        type: "text",
                                        text: `${data.reportedBy.name}${
                                            data.reportedBy.department
                                                ? ` (${data.reportedBy.department})`
                                                : ""
                                        }`,
                                        wrap: true,
                                        color: "#333333",
                                        size: "sm",
                                        flex: 3,
                                    },
                                ],
                            },
                            {
                                type: "box",
                                layout: "baseline",
                                spacing: "sm",
                                contents: [
                                    {
                                        type: "text",
                                        text: "วันที่:",
                                        color: "#666666",
                                        size: "sm",
                                        flex: 2,
                                    },
                                    {
                                        type: "text",
                                        text: formatDate(data.createdAt),
                                        wrap: true,
                                        color: "#333333",
                                        size: "sm",
                                        flex: 3,
                                    },
                                ],
                            },
                        ],
                    },
                    ...(data.description
                        ? [
                              {
                                  type: "separator" as const,
                                  margin: "md" as const,
                              },
                              {
                                  type: "text" as const,
                                  text:
                                      data.description.length > 100
                                          ? data.description.substring(0, 100) +
                                            "..."
                                          : data.description,
                                  wrap: true,
                                  color: "#666666",
                                  size: "sm" as const,
                                  margin: "md" as const,
                              },
                          ]
                        : []),
                ],
            },
            footer: {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [
                    {
                        type: "button",
                        style: "primary",
                        height: "sm",
                        action: {
                            type: "uri",
                            label: "ดูในระบบ",
                            uri: `${baseUrl}/dashboard/it-issues`,
                        },
                        color: headerColor,
                    },
                    {
                        type: "spacer",
                        size: "sm",
                    },
                ],
            },
        },
    };
}
