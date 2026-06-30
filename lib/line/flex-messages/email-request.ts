import { type EmailRequestData, type LineFlexMessage } from "@/types/api";
import { formatDate } from "../helpers";

export function generateEmailRequestFlexMessage(
    data: EmailRequestData,
    baseUrl: string
): LineFlexMessage {
    const documentSystemText = data.needsDocumentSystem
        ? "ต้องการ"
        : "ไม่ต้องการ";
    const sharedDriveText =
        data.sharedDriveAccess.length > 0
            ? data.sharedDriveAccess.join(", ")
            : "ไม่ได้ระบุ";

    return {
        type: "flex",
        altText: `ส่งคำร้องพนักงานใหม่ - ${data.thaiName}`,
        contents: {
            type: "bubble",
            header: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: "📧 ส่งคำร้องพนักงานใหม่",
                        weight: "bold",
                        color: "#FFFFFF",
                        size: "lg",
                    },
                    {
                        type: "text",
                        text: "คำร้องพนักงานใหม่จากระบบ",
                        color: "#FFFFFF",
                        size: "sm",
                    },
                ],
                backgroundColor: "#7C3AED",
                paddingAll: "20px",
            },
            body: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: `${data.thaiName} (${data.englishName})`,
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
                                        text: "ชื่อเล่น:",
                                        color: "#666666",
                                        size: "sm",
                                        flex: 2,
                                    },
                                    {
                                        type: "text",
                                        text: data.nickname,
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
                                        text: "สารบรรณ:",
                                        color: "#666666",
                                        size: "sm",
                                        flex: 2,
                                    },
                                    {
                                        type: "text",
                                        text: documentSystemText,
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
                                        text: "Shared Drive:",
                                        color: "#666666",
                                        size: "sm",
                                        flex: 2,
                                    },
                                    {
                                        type: "text",
                                        text: sharedDriveText,
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
                                        text: "เบอร์โทร:",
                                        color: "#666666",
                                        size: "sm",
                                        flex: 2,
                                    },
                                    {
                                        type: "text",
                                        text: data.phone,
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
                                        text: "ตำแหน่ง:",
                                        color: "#666666",
                                        size: "sm",
                                        flex: 2,
                                    },
                                    {
                                        type: "text",
                                        text: data.position,
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
                                        text: "สังกัด:",
                                        color: "#666666",
                                        size: "sm",
                                        flex: 2,
                                    },
                                    {
                                        type: "text",
                                        text: data.department,
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
                                        text: "อีเมลตอบกลับ:",
                                        color: "#666666",
                                        size: "sm",
                                        flex: 2,
                                    },
                                    {
                                        type: "text",
                                        text: data.replyEmail,
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
                                        text: "วันที่ขอ:",
                                        color: "#666666",
                                        size: "sm",
                                        flex: 2,
                                    },
                                    {
                                        type: "text",
                                        text: formatDate(data.requestedAt),
                                        wrap: true,
                                        color: "#333333",
                                        size: "sm",
                                        flex: 3,
                                    },
                                ],
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
                            label: "ดูคำร้องในระบบ",
                            uri: `${baseUrl}/dashboard?tab=email-request`,
                        },
                        color: "#7C3AED",
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
