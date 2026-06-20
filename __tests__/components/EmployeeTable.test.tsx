import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmployeeTable } from "@/components/employee/EmployeeTable";
import type { Employee } from "@/types/employees";

const employee: Employee = {
    id: 1,
    firstName: "นางสาวสมใจ",
    lastName: "นามสกุลยาวเพื่อทดสอบการแสดงผล",
    nickname: "สมใจ",
    phone: "0812345678",
    email: "somjai.long.employee.address@nhf.or.th",
    position: "เจ้าหน้าที่บริหารงานทั่วไป",
    affiliation: "มูลนิธิสาธารณสุขแห่งชาติ",
    hireDate: "2020-01-01",
    status: "ACTIVE",
    dept: { id: 1, name: "บริหาร", code: "ADMIN" },
    createdAt: "2020-01-01T00:00:00.000Z",
    updatedAt: "2020-01-01T00:00:00.000Z",
};

describe("EmployeeTable", () => {
    it("keeps full names and email addresses on one line without truncation", () => {
        render(<EmployeeTable employees={[employee]} />);

        const fullName = "นางสาวสมใจ นามสกุลยาวเพื่อทดสอบการแสดงผล";
        const table = screen.getByRole("table");
        const fullNameValue = within(table).getByText(fullName);
        const emailValue = within(table).getByText(employee.email);

        [fullNameValue, emailValue].forEach((value) => {
            expect(value).toHaveClass("whitespace-nowrap");
            expect(value).not.toHaveClass("truncate");
        });
    });
});
