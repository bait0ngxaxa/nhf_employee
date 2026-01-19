import { describe, it, expect } from "vitest";
import {
    createEmployeeSchema,
    updateEmployeeSchema,
} from "@/lib/validations/employee";

describe("Employee Validation", () => {
    describe("createEmployeeSchema", () => {
        it("should validate correct data", () => {
            const data = {
                firstName: "John",
                lastName: "Doe",
                email: "john@test.com",
                position: "Dev",
                departmentId: 1,
            };
            const result = createEmployeeSchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it("should convert departmentId string to number", () => {
            const data = {
                firstName: "John",
                lastName: "Doe",
                email: "john@test.com",
                position: "Dev",
                departmentId: "5",
            };
            const result = createEmployeeSchema.safeParse(data);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.departmentId).toBe(5);
            }
        });

        it("should fail on invalid email", () => {
            const data = {
                firstName: "John",
                lastName: "Doe",
                email: "invalid-email",
                position: "Dev",
                departmentId: 1,
            };
            const result = createEmployeeSchema.safeParse(data);
            expect(result.success).toBe(false);
        });

        it("should fail on missing required fields", () => {
            const data = {
                firstName: "John",
            };
            const result = createEmployeeSchema.safeParse(data);
            expect(result.success).toBe(false);
        });
    });

    describe("updateEmployeeSchema", () => {
        it("should allow partial updates", () => {
            const result = updateEmployeeSchema.safeParse({
                firstName: "New Name",
            });
            expect(result.success).toBe(true);
        });

        it("should allow empty string for email if allowed by schema", () => {
            // Schema allows literal ""
            const result = updateEmployeeSchema.safeParse({ email: "" });
            expect(result.success).toBe(true);
        });
    });
});
