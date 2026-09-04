import type { LineFlexMessage } from "@/types/api";

export interface RoutineReminderFlexMessageData {
    taskTitle: string;
    unitName: string;
    categoryName: string;
    dueDateLabel: string;
    timingLabel: string;
    actionUrl: string;
}

export function generateRoutineReminderFlexMessage(
    data: RoutineReminderFlexMessageData,
): LineFlexMessage {
    return {
        type: "flex",
        altText: `แจ้งเตือนงาน Routine: ${data.taskTitle}`,
        contents: {
            type: "bubble",
            header: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: "แจ้งเตือนงาน Routine",
                        weight: "bold",
                        color: "#FFFFFF",
                        size: "lg",
                    },
                ],
                backgroundColor: "#2563EB",
                paddingAll: "20px",
            },
            body: {
                type: "box",
                layout: "vertical",
                spacing: "sm",
                contents: [
                    {
                        type: "text",
                        text: data.taskTitle,
                        weight: "bold",
                        size: "lg",
                        wrap: true,
                    },
                    {
                        type: "box",
                        layout: "vertical",
                        margin: "md",
                        spacing: "sm",
                        contents: [
                            {
                                type: "text",
                                text: `หน่วยงาน: ${data.unitName}`,
                                color: "#4B5563",
                                size: "sm",
                                wrap: true,
                            },
                            {
                                type: "text",
                                text: `หมวดหมู่: ${data.categoryName}`,
                                color: "#4B5563",
                                size: "sm",
                                wrap: true,
                            },
                            {
                                type: "text",
                                text: `ครบกำหนด: ${data.dueDateLabel}`,
                                color: "#111827",
                                size: "sm",
                                wrap: true,
                            },
                            {
                                type: "text",
                                text: data.timingLabel,
                                color: "#1D4ED8",
                                size: "sm",
                                weight: "bold",
                                wrap: true,
                            },
                        ],
                    },
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
                            label: "เปิดดูงาน",
                            uri: data.actionUrl,
                        },
                        color: "#2563EB",
                    },
                ],
            },
        },
    };
}
