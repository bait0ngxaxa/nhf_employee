import { describe, expect, it } from "vitest";

import { generateRoutineReminderFlexMessage } from "@/lib/line/flex-messages/routine-reminder";

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

        expect(message.altText).toBe("แจ้งเตือนงาน Routine: ตรวจสอบระบบประจำเดือน");
        expect(JSON.stringify(message)).toContain("ฝ่าย IT");
        expect(JSON.stringify(message)).toContain("ครบกำหนดวันนี้");
        expect(JSON.stringify(message)).toContain(
            "https://liff.line.me/routine-id?taskId=71&occurrenceId=91",
        );
    });
});
