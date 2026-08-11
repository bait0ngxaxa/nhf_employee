import { describe, it, expect } from "vitest";
import {
    getEmployeeBackedUserDisplayName,
    getEmployeeDisplayName,
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

    describe("getEmployeeDisplayName", () => {
        it("includes a normalized nickname", () => {
            expect(getEmployeeDisplayName({
                firstName: "  สมชาย ",
                lastName: " ใจดี  ",
                nickname: " ชาย ",
            })).toBe("สมชาย ใจดี (ชาย)");
        });

        it.each([null, undefined, "", "   "])(
            "omits empty nickname parentheses for %s",
            (nickname) => {
                expect(getEmployeeDisplayName({
                    firstName: "สมชาย",
                    lastName: "ใจดี",
                    nickname,
                })).toBe("สมชาย ใจดี");
            },
        );
    });

    describe("getEmployeeBackedUserDisplayName", () => {
        it("prefers canonical Employee identity", () => {
            expect(getEmployeeBackedUserDisplayName({
                name: "ชื่อเดิม",
                email: "employee@example.com",
                employee: {
                    firstName: "สมชาย",
                    lastName: "ใจดี",
                    nickname: "ชาย",
                },
            })).toBe("สมชาย ใจดี (ชาย)");
        });

        it("falls back through user name and email", () => {
            expect(getEmployeeBackedUserDisplayName({
                name: " ผู้ดูแลระบบ ",
                email: "admin@example.com",
                employee: null,
            })).toBe("ผู้ดูแลระบบ");
            expect(getEmployeeBackedUserDisplayName({
                name: " ",
                email: " admin@example.com ",
                employee: null,
            })).toBe("admin@example.com");
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
            expect(formatEmployeePhone("0812345678")).toBe("081-2345678");
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
