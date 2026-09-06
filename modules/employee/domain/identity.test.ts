import { describe, expect, it } from "vitest";

import {
    getEmployeeDisplayName,
    getEmployeeEmailStatus,
    getEmployeeFullName,
} from "./identity";

describe("Employee identity", () => {
    it("normalizes first and last names", () => {
        expect(getEmployeeFullName(" John", "Doe ")).toBe("John Doe");
    });

    it("includes a normalized nickname when present", () => {
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

    it("uses the nickname when both name parts are blank", () => {
        expect(getEmployeeDisplayName({
            firstName: " ",
            lastName: "",
            nickname: " ชาย ",
        })).toBe("ชาย");
    });

    it.each([
        ["user@temp.local", "temp"],
        ["user@company.com", "valid"],
        ["", "invalid"],
    ] as const)("classifies email %s as %s", (email, expected) => {
        expect(getEmployeeEmailStatus(email)).toBe(expected);
    });
});
