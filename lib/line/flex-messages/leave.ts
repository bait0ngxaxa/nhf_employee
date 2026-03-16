import { type LeaveActionPayload } from "../../email/types";

export function generateLeaveActionFlexMessage(data: LeaveActionPayload, approveLink: string, rejectLink: string) {
    const typeLabel = data.leaveType === "SICK" ? "ลาป่วย" : data.leaveType === "PERSONAL" ? "ลากิจ" : "ลาพักร้อน";

    return {
        type: "flex",
        altText: `คำขออนุมัติลางานใหม่: ${data.employeeName}`,
        contents: {
            type: "bubble",
            size: "giga",
            header: {
                type: "box",
                layout: "vertical",
                contents: [
                    {
                        type: "text",
                        text: "New Leave Request!!",
                        weight: "bold",
                        size: "lg",
                        color: "#ef4444"
                    }
                ],
                backgroundColor: "#fef2f2"
            },
            body: {
                type: "box",
                layout: "vertical",
                spacing: "md",
                contents: [
                    {
                        type: "text",
                        text: `${data.employeeName} ขออนุมัติลางาน`,
                        weight: "bold",
                        wrap: true
                    },
                    {
                        type: "box",
                        layout: "baseline",
                        contents: [
                            { type: "text", text: "ประเภท", color: "#aaaaaa", size: "sm", flex: 2 },
                            { type: "text", text: typeLabel, wrap: true, color: "#666666", size: "sm", flex: 5 }
                        ]
                    },
                    {
                        type: "box",
                        layout: "baseline",
                        contents: [
                            { type: "text", text: "วันที่", color: "#aaaaaa", size: "sm", flex: 2 },
                            { type: "text", text: `${data.startDate} ถึง ${data.endDate} (${data.durationDays} วัน)`, wrap: true, color: "#666666", size: "sm", flex: 5 }
                        ]
                    },
                    {
                        type: "box",
                        layout: "baseline",
                        contents: [
                            { type: "text", text: "เหตุผล", color: "#aaaaaa", size: "sm", flex: 2 },
                            { type: "text", text: data.reason, wrap: true, color: "#666666", size: "sm", flex: 5 }
                        ]
                    }
                ]
            },
            footer: {
                type: "box",
                layout: "horizontal",
                spacing: "sm",
                contents: [
                    {
                        type: "button",
                        style: "primary",
                        color: "#10b981",
                        action: { type: "uri", label: "อนุมัติ", uri: approveLink }
                    },
                    {
                        type: "button",
                        style: "primary",
                        color: "#ef4444",
                        action: { type: "uri", label: "ไม่อนุมัติ", uri: rejectLink }
                    }
                ]
            }
        }
    };
}
