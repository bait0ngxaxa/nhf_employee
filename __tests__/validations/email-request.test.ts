import { describe, it, expect } from "vitest";
import { emailRequestSchema } from "@/lib/validations/email-request";

describe("Email Request Validation", () => {
    it("should validate correct data", () => {
        const data = {
            thaiName: "สมชาย",
            englishName: "Somchai",
            phone: "0812345678",
            nickname: "Chai",
            position: "Dev",
            department: "IT",
            replyEmail: "test@email.com",
        };
        const result = emailRequestSchema.safeParse(data);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.phone).toBe("081-2345678");
            expect(result.data.needsDocumentSystem).toBe(false);
            expect(result.data.sharedDriveAccess).toEqual([]);
        }
    });

    it("should validate dashed phone format", () => {
        const data = {
            thaiName: "สมชาย",
            englishName: "Somchai",
            phone: "081-2345678",
            nickname: "Chai",
            position: "Dev",
            department: "IT",
            replyEmail: "test@email.com",
        };
        const result = emailRequestSchema.safeParse(data);
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.phone).toBe("081-2345678");
        }
    });

    it("should fail on invalid phone format", () => {
        const data = {
            thaiName: "สมชาย",
            englishName: "Somchai",
            phone: "abc", // Invalid
            nickname: "Chai",
            position: "Dev",
            department: "IT",
            replyEmail: "test@email.com",
        };
        const result = emailRequestSchema.safeParse(data);
        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error.flatten().fieldErrors.phone).toBeDefined();
        }
    });

    it("should validate document system and shared drive access", () => {
        const data = {
            thaiName: "สมชาย",
            englishName: "Somchai",
            phone: "0812345678",
            nickname: "Chai",
            position: "Dev",
            department: "IT",
            replyEmail: "test@email.com",
            needsDocumentSystem: true,
            sharedDriveAccess: ["account", "it", "project_research"],
        };

        const result = emailRequestSchema.safeParse(data);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.needsDocumentSystem).toBe(true);
            expect(result.data.sharedDriveAccess).toEqual([
                "account",
                "it",
                "project_research",
            ]);
        }
    });

    it("should fail on unknown shared drive access", () => {
        const data = {
            thaiName: "สมชาย",
            englishName: "Somchai",
            phone: "0812345678",
            nickname: "Chai",
            position: "Dev",
            department: "IT",
            replyEmail: "test@email.com",
            needsDocumentSystem: false,
            sharedDriveAccess: ["unknown_drive"],
        };

        const result = emailRequestSchema.safeParse(data);

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(
                result.error.flatten().fieldErrors.sharedDriveAccess,
            ).toBeDefined();
        }
    });

    it("should fail on duplicate shared drive access", () => {
        const data = {
            thaiName: "สมชาย",
            englishName: "Somchai",
            phone: "0812345678",
            nickname: "Chai",
            position: "Dev",
            department: "IT",
            replyEmail: "test@email.com",
            needsDocumentSystem: false,
            sharedDriveAccess: ["it", "it"],
        };

        const result = emailRequestSchema.safeParse(data);

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(
                result.error.flatten().fieldErrors.sharedDriveAccess,
            ).toContain("ไม่ควรเลือก Shared Drive ซ้ำ");
        }
    });
});
