import { describe, expect, it } from "vitest";

import { signupSchema } from "@/lib/validations/auth";

describe("Auth Validation", () => {
    describe("signupSchema", () => {
        it("should accept valid organization signup payload", () => {
            const result = signupSchema.safeParse({
                email: "USER@thainhf.org",
                password: "secret1",
                confirmPassword: "secret1",
            });

            expect(result.success).toBe(true);
            expect(result.success && result.data.email).toBe("user@thainhf.org");
        });

        it("should reject non organization email", () => {
            const result = signupSchema.safeParse({
                email: "user@gmail.com",
                password: "secret1",
                confirmPassword: "secret1",
            });

            expect(result.success).toBe(false);
        });

        it("should reject mismatched passwords", () => {
            const result = signupSchema.safeParse({
                email: "user@thainhf.org",
                password: "secret1",
                confirmPassword: "secret2",
            });

            expect(result.success).toBe(false);
        });
    });
});
