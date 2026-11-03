import { describe, expect, it } from "vitest";

import { NOTIFICATION_ACTIONS, NOTIFICATION_STATUS_COLORS } from "@/shared/notifications/presentation";
import { validateNotificationFlexMessage } from "@/__tests__/lib/notification-flex-contract";
import { generateRoutineContractExpiryFlexMessage } from "./routine-contract-expiry-flex";

describe("Routine contract expiry LINE Flex message", () => {
    it("keeps a long Thai task, contract date, warning and existing action readable", () => {
        const taskTitle = "ดูแลระบบสำรองข้อมูลประจำหน่วยงาน".repeat(7);
        const unitName = "หน่วยงานสาธารณสุขประจำจังหวัด".repeat(5);
        const categoryName = "ระบบสารสนเทศประจำหน่วยงาน".repeat(5);
        const actionUrl = "https://liff.line.me/nhfapp-liff-id/routine?taskId=72";
        const message = generateRoutineContractExpiryFlexMessage({
            taskTitle,
            unitName,
            categoryName,
            contractEndDateLabel: "30 พฤศจิกายน 2569",
            actionUrl,
        });
        const body = message.contents.body?.contents;
        const detailSection = body?.[2];

        expect(validateNotificationFlexMessage(message)).toEqual([]);
        expect(Array.from(taskTitle).length).toBeLessThanOrEqual(255);
        expect(Array.from(unitName).length).toBeLessThanOrEqual(200);
        expect(Array.from(categoryName).length).toBeLessThanOrEqual(200);
        expect(body?.[0]).toMatchObject({
            text: "สัญญาใกล้สิ้นสุด",
            color: NOTIFICATION_STATUS_COLORS.warning,
            wrap: true,
            scaling: true,
        });
        expect(body?.[1]).toMatchObject({ text: taskTitle, wrap: true, scaling: true });
        expect(detailSection).toMatchObject({ type: "box", layout: "vertical" });
        if (detailSection?.type !== "box") throw new Error("Routine contract details are missing");

        expect(detailSection.contents[0]).toMatchObject({
            type: "box",
            layout: "horizontal",
            contents: [
                { text: "หน่วยงาน:", scaling: true, wrap: true },
                { text: unitName, scaling: true, wrap: true },
            ],
        });
        expect(detailSection.contents[1]).toMatchObject({
            type: "box",
            layout: "horizontal",
            contents: [
                { text: "หมวดหมู่:", scaling: true, wrap: true },
                { text: categoryName, scaling: true, wrap: true },
            ],
        });
        expect(detailSection.contents[2]).toMatchObject({
            type: "box",
            contents: [
                { text: "สิ้นสุดสัญญา:", scaling: true, wrap: true },
                { text: "30 พฤศจิกายน 2569", scaling: true, wrap: true },
            ],
        });
        expect(detailSection.contents[3]).toMatchObject({
            type: "text",
            text: "เหลือเวลาประมาณ 1 เดือน กรุณาตรวจสอบและดำเนินการที่เกี่ยวข้อง",
            color: NOTIFICATION_STATUS_COLORS.warning,
            scaling: true,
            wrap: true,
        });
        expect(message.contents.footer?.contents[0]).toMatchObject({
            type: "button",
            scaling: true,
            action: { label: NOTIFICATION_ACTIONS.task, uri: actionUrl },
        });
    });
});
