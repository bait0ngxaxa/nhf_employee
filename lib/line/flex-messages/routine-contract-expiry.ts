import type { LineFlexMessage } from "@/types/api";

export interface RoutineContractExpiryFlexMessageData {
    taskTitle: string;
    unitName: string;
    categoryName: string;
    contractEndDateLabel: string;
    actionUrl: string;
}

export function generateRoutineContractExpiryFlexMessage(
    data: RoutineContractExpiryFlexMessageData,
): LineFlexMessage {
    return {
        type: "flex",
        altText: `แจ้งเตือนสัญญาใกล้สิ้นสุด: ${data.taskTitle}`,
        contents: {
            type: "bubble",
            header: {
                type: "box",
                layout: "vertical",
                contents: [{
                    type: "text",
                    text: "สัญญาใกล้สิ้นสุด",
                    weight: "bold",
                    color: "#FFFFFF",
                    size: "lg",
                }],
                backgroundColor: "#C2410C",
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
                                text: `สิ้นสุดสัญญา: ${data.contractEndDateLabel}`,
                                color: "#111827",
                                size: "sm",
                                wrap: true,
                            },
                            {
                                type: "text",
                                text: "เหลือเวลาประมาณ 1 เดือน กรุณาตรวจสอบและดำเนินการที่เกี่ยวข้อง",
                                color: "#9A3412",
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
                contents: [{
                    type: "button",
                    style: "primary",
                    height: "sm",
                    action: {
                        type: "uri",
                        label: "เปิดดูงาน",
                        uri: data.actionUrl,
                    },
                    color: "#C2410C",
                }],
            },
        },
    };
}
