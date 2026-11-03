import { describe, expect, it } from "vitest";

import { generateRoutineReminderFlexMessage } from "./routine-reminder-flex";
import { NOTIFICATION_STATUS_COLORS } from "@/shared/notifications/presentation";
import { validateNotificationFlexMessage } from "@/__tests__/lib/notification-flex-contract";

describe("Routine LINE reminder Flex message", () => {
    it("renders the normalized Routine details and action URL", () => {
        const unitName = "ฝ่ายเทคโนโลยีสารสนเทศ";
        const message = generateRoutineReminderFlexMessage({
            taskTitle: "ตรวจสอบระบบประจำเดือน",
            unitName,
            categoryName: "รายงาน",
            dueDateLabel: "10 สิงหาคม 2569",
            timingLabel: "ครบกำหนดวันนี้",
            actionUrl: "https://liff.line.me/routine-id?taskId=71&occurrenceId=91",
        });

        expect(validateNotificationFlexMessage(message)).toEqual([]);
        expect(message.altText).toBe("Routine: งานใกล้ถึงกำหนด: ตรวจสอบระบบประจำเดือน");
        expect(message.contents.body?.contents[0]).toMatchObject({ color: NOTIFICATION_STATUS_COLORS.warning });
        expect(JSON.stringify(message)).toContain(unitName);
        expect(JSON.stringify(message)).toContain("ครบกำหนดวันนี้");
        const detailSection = message.contents.body?.contents[2];
        if (detailSection?.type === "box") {
            expect(detailSection.contents[3]).toMatchObject({ color: NOTIFICATION_STATUS_COLORS.warning });
            expect(detailSection.contents[3]).toMatchObject({ scaling: true, wrap: true });
            expect(detailSection.contents[2]).toMatchObject({
                type: "box",
                contents: [
                    { text: "ครบกำหนด:", scaling: true, wrap: true },
                    { text: "10 สิงหาคม 2569", scaling: true, wrap: true },
                ],
            });
            const unitDetail = detailSection.contents[0];
            const categoryDetail = detailSection.contents[1];
            expect(unitDetail).toMatchObject({
                type: "box",
                layout: "horizontal",
                contents: [
                    { text: "หน่วยงาน:", scaling: true, wrap: true },
                    { text: unitName, scaling: true, wrap: true },
                ],
            });
            expect(categoryDetail).toMatchObject({ type: "box", layout: "horizontal" });
        } else {
            throw new Error("Routine detail section is missing");
        }
        expect(JSON.stringify(message)).toContain(
            "https://liff.line.me/routine-id?taskId=71&occurrenceId=91",
        );
    });

    it("wraps a long Thai task name while keeping the LINE preview within its limit", () => {
        const taskTitle = "งานประจำภาษาไทย".repeat(16);
        const unitName = "หน่วยงานสาธารณสุขประจำจังหวัด".repeat(5);
        const categoryName = "ระบบสารสนเทศประจำหน่วยงาน".repeat(5);
        const message = generateRoutineReminderFlexMessage({
            taskTitle,
            unitName,
            categoryName,
            dueDateLabel: "10 สิงหาคม 2569",
            timingLabel: "เหลือเวลา 2 วัน",
            actionUrl: "https://liff.line.me/routine-id?taskId=71",
        });

        expect(validateNotificationFlexMessage(message)).toEqual([]);
        expect(taskTitle.length).toBeLessThanOrEqual(255);
        expect(unitName.length).toBeLessThanOrEqual(200);
        expect(categoryName.length).toBeLessThanOrEqual(200);
        expect(message.contents.body?.contents[1]).toMatchObject({ text: taskTitle, wrap: true, scaling: true });
        const detailSection = message.contents.body?.contents[2];
        if (detailSection?.type !== "box") throw new Error("Routine detail section is missing");
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
        expect(message.altText).toBe(`Routine: งานใกล้ถึงกำหนด: ${taskTitle}`);
    });
});
