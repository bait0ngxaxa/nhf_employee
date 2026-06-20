import { describe, expect, it } from "vitest";
import { getEmployeeAvatarLetter } from "@/components/employee/EmployeeTablePrimitives";
import type { Employee } from "@/types/employees";

function createEmployee(firstName: string): Employee {
    return {
        id: 1,
        firstName,
        lastName: "ทดสอบ",
        email: "employee@nhf.or.th",
        position: "เจ้าหน้าที่",
        hireDate: "2020-01-01",
        status: "ACTIVE",
        dept: { id: 1, name: "บริหาร", code: "ADMIN" },
        createdAt: "2020-01-01T00:00:00.000Z",
        updatedAt: "2020-01-01T00:00:00.000Z",
    };
}

describe("getEmployeeAvatarLetter", () => {
    it("uses the first Thai consonant when a name starts with a leading vowel", () => {
        expect(getEmployeeAvatarLetter(createEmployee("เอก"))).toBe("อ");
        expect(getEmployeeAvatarLetter(createEmployee("ไก่"))).toBe("ก");
    });

    it("uses the first character for non-Thai names and a fallback for blank names", () => {
        expect(getEmployeeAvatarLetter(createEmployee("Alice"))).toBe("A");
        expect(getEmployeeAvatarLetter(createEmployee("Aliceก"))).toBe("A");
        expect(getEmployeeAvatarLetter(createEmployee("   "))).toBe("N");
    });
});
