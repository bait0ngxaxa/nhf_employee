import { describe, it, expect } from "vitest";
import {
    getEmployeeFullName,
    getEmployeeEmailStatus,
    formatEmployeePhone,
    isEmployeeActive,
} from "@/lib/helpers/employee-helpers";

describe("Employee Helpers", () => {
    describe("getEmployeeFullName", () => {
        it("should combine first and last name", () => {
            expect(getEmployeeFullName("John", "Doe")).toBe("John Doe");
        });

        it("should trim whitespace", () => {
            expect(getEmployeeFullName(" John", "Doe ")).toBe("John Doe");
        });
    });

    describe("getEmployeeEmailStatus", () => {
        it("should identify temp email", () => {
            expect(getEmployeeEmailStatus("user@temp.local")).toBe("temp");
        });

        it("should identify valid email", () => {
            expect(getEmployeeEmailStatus("user@company.com")).toBe("valid");
        });

        it("should identify invalid email", () => {
            expect(getEmployeeEmailStatus("")).toBe("invalid");
        });
    });

    describe("formatEmployeePhone", () => {
        it("should format 10 digit phone", () => {
            expect(formatEmployeePhone("0812345678")).toBe("081-234-5678");
        });

        it("should return original if not 10 digits", () => {
            expect(formatEmployeePhone("123")).toBe("123");
        });
    });

    describe("isEmployeeActive", () => {
        it("should return true for ACTIVE", () => {
            expect(isEmployeeActive("ACTIVE")).toBe(true);
        });
    });
});
