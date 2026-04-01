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
});
