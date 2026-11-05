import { describe, it, expect } from "vitest";
import {
    createEmployeeSchema,
    updateEmployeeSchema,
} from "./employee";

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
            if (result.success) expect(result.data.hireDate).toBeNull();
        });

        it("accepts a valid optional date-only hire date", () => {
            const result = createEmployeeSchema.safeParse({
                firstName: "John",
                lastName: "Doe",
                email: "john@test.com",
                position: "Dev",
                departmentId: 1,
                hireDate: "2023-04-01",
            });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.hireDate).toEqual(new Date("2023-04-01T00:00:00.000Z"));
            }
        });

        it.each(["2026-02-30", "01/02/2026", "2026-11-04T00:00:00.000Z"])(
            "rejects non-canonical or invalid hire date %s",
            (hireDate) => {
                const result = createEmployeeSchema.safeParse({
                    firstName: "John",
                    lastName: "Doe",
                    email: "john@test.com",
                    position: "Dev",
                    departmentId: 1,
                    hireDate,
                });

                expect(result.success).toBe(false);
            },
        );

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
            if (result.success) expect(result.data).not.toHaveProperty("hireDate");
        });

        it("distinguishes an omitted hire date from explicit null and a date value", () => {
            const unchanged = updateEmployeeSchema.safeParse({ firstName: "New" });
            const cleared = updateEmployeeSchema.safeParse({ hireDate: null });
            const changed = updateEmployeeSchema.safeParse({ hireDate: "2023-04-01" });

            expect(unchanged.success).toBe(true);
            if (unchanged.success) expect(unchanged.data).not.toHaveProperty("hireDate");
            expect(cleared.success).toBe(true);
            if (cleared.success) expect(cleared.data.hireDate).toBeNull();
            expect(changed.success).toBe(true);
            if (changed.success) {
                expect(changed.data.hireDate).toEqual(new Date("2023-04-01T00:00:00.000Z"));
            }
        });

        it("should allow empty string for email if allowed by schema", () => {
            // Schema allows literal ""
            const result = updateEmployeeSchema.safeParse({ email: "" });
            expect(result.success).toBe(true);
        });

        it("strips managerId so generic employee updates cannot bypass approver policy", () => {
            const result = updateEmployeeSchema.safeParse({ managerId: 20 });

            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).not.toHaveProperty("managerId");
            }
        });
    });
});
