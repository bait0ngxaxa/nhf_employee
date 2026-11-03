import { describe, expect, it } from "vitest";

import { generateRoutineReminderFlexMessage } from "./routine-reminder-flex";
import { NOTIFICATION_STATUS_COLORS } from "@/shared/notifications/presentation";

describe("Routine LINE reminder Flex message", () => {
    it("renders the normalized Routine details and action URL", () => {
        const message = generateRoutineReminderFlexMessage({
            taskTitle: "ตรวจสอบระบบประจำเดือน",
            unitName: "ฝ่าย IT",
            categoryName: "รายงาน",
            dueDateLabel: "10 สิงหาคม 2569",
            timingLabel: "ครบกำหนดวันนี้",
            actionUrl: "https://liff.line.me/routine-id?taskId=71&occurrenceId=91",
        });

        expect(message.altText).toBe("Routine: งานใกล้ถึงกำหนด: ตรวจสอบระบบประจำเดือน");
        expect(message.contents.body?.contents[0]).toMatchObject({ color: NOTIFICATION_STATUS_COLORS.warning });
        expect(JSON.stringify(message)).toContain("ฝ่าย IT");
        expect(JSON.stringify(message)).toContain("ครบกำหนดวันนี้");
        const detailSection = message.contents.body?.contents[2];
        if (detailSection?.type === "box") {
            expect(detailSection.contents[3]).toMatchObject({ color: NOTIFICATION_STATUS_COLORS.warning });
        } else {
            throw new Error("Routine detail section is missing");
        }
        expect(JSON.stringify(message)).toContain(
            "https://liff.line.me/routine-id?taskId=71&occurrenceId=91",
        );
    });

    it("wraps a long Thai task name while keeping the LINE preview within its limit", () => {
        const taskTitle = "งานประจำภาษาไทย".repeat(80);
        const message = generateRoutineReminderFlexMessage({
            taskTitle,
            unitName: "หน่วยงาน",
            categoryName: "หมวดหมู่",
            dueDateLabel: "10 สิงหาคม 2569",
            timingLabel: "เหลือเวลา 2 วัน",
            actionUrl: "https://liff.line.me/routine-id?taskId=71",
        });

        expect(message.contents.body?.contents[1]).toMatchObject({ text: taskTitle, wrap: true });
        expect(message.altText).toHaveLength(400);
    });
});
