import type { LineFlexMessage } from "@/types/api";

export function generateEmailRequestFlexMessage(
    emailRequestId: number | null,
    actionUrl: string,
    accessVersion?: number,
): LineFlexMessage {
    const label = emailRequestId === null
        ? "คำร้องอีเมลพนักงานใหม่"
        : `คำร้องอีเมลพนักงานใหม่ #${emailRequestId}`;

    return {
        type: "flex",
        altText: accessVersion === undefined ? `${label} รอตรวจสอบ` : `มีการอัปเดตสิทธิ์พนักงานใหม่ #${emailRequestId}`,
        contents: {
            type: "bubble",
            header: {
                type: "box",
                layout: "vertical",
                paddingAll: "20px",
                backgroundColor: "#7C3AED",
                contents: [{
                    type: "text",
                    text: accessVersion === undefined ? "มีคำร้องพนักงานใหม่" : "มีการอัปเดตสิทธิ์พนักงานใหม่",
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
                        text: label,
                        size: "md",
                        weight: "bold",
                        wrap: true,
                    },
                    {
                        type: "text",
                        text: accessVersion === undefined ? "มีคำขออีเมลพนักงานใหม่รอตรวจสอบ" : "มีการระบุหรือแก้ไขสิทธิ์การใช้งานเพิ่มเติม",
                        color: "#4B5563",
                        size: "sm",
                        wrap: true,
                    },
                ],
            },
            footer: {
                type: "box",
                layout: "vertical",
                contents: [{
                    type: "button",
                    style: "primary",
                    height: "sm",
                    color: "#7C3AED",
                    action: {
                        type: "uri",
                        label: "เปิดคำร้องในระบบ",
                        uri: actionUrl,
                    },
                }],
            },
        },
    };
}
