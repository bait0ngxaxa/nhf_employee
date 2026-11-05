import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmployeeTable } from "./EmployeeTable";
import type { Employee } from "./types";

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

describe("EmployeeTable compact directory", () => {
    it("shows only essential desktop columns with separate full name and nickname", () => {
        render(<EmployeeTable employees={[employee]} canUpdateEmployees={false} />);
        const table = screen.getByRole("table");
        expect(within(table).getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
            "ชื่อ-นามสกุล", "ชื่อเล่น", "อีเมล", "สถานะ", "การจัดการ",
        ]);
        expect(within(table).getByText(`${employee.firstName} ${employee.lastName}`)).toBeInTheDocument();
        expect(within(table).getByText(employee.nickname ?? "")).toBeInTheDocument();
        expect(table).not.toHaveTextContent(`(${employee.nickname})`);
        expect(table).toHaveClass("w-full", "table-fixed");
        expect(table.className).not.toMatch(/min-w-|w-max/);
        for (const value of [employee.email, `${employee.firstName} ${employee.lastName}`]) {
            expect(within(table).getByText(value)).toHaveClass("[overflow-wrap:anywhere]");
            expect(within(table).getByText(value)).not.toHaveClass("whitespace-nowrap", "truncate");
        }
    });

    it("keeps employment and contact details out of both collapsed layouts", () => {
        render(<EmployeeTable employees={[employee]} canUpdateEmployees={false} />);
        for (const container of [screen.getByRole("table"), screen.getByRole("article")]) {
            for (const value of [employee.position, employee.affiliation ?? "", employee.dept.name, "081-2345678", "01/01/2563"]) {
                expect(container).not.toHaveTextContent(value);
            }
            for (const label of ["ตำแหน่ง", "แผนก", "สังกัด", "เบอร์โทร", "วันที่เริ่มงาน", "อายุงาน"]) {
                expect(container).not.toHaveTextContent(label);
            }
        }
        const card = screen.getByRole("article");
        expect(within(card).getByRole("heading")).toHaveTextContent(`${employee.firstName} ${employee.lastName}`);
        expect(within(card).getByText(employee.email)).toHaveClass("[overflow-wrap:anywhere]");
        expect(within(card).getByText(employee.nickname ?? "")).toBeInTheDocument();
        expect(within(card).getByText("ทำงานอยู่")).toBeInTheDocument();
    });

    it("allows read-only details in both layouts without edit controls", () => {
        const edit = vi.fn();
        render(<EmployeeTable employees={[employee]} canUpdateEmployees={false} onEditEmployee={edit} />);
        expect(screen.queryByRole("button", { name: /แก้ไข/ })).not.toBeInTheDocument();
        for (const container of [screen.getByRole("table"), screen.getByRole("article")]) {
            fireEvent.click(within(container).getByRole("button", { name: /ดูรายละเอียด/ }));
            expect(screen.getByRole("dialog")).toBeInTheDocument();
            expect(within(screen.getByRole("dialog")).queryByRole("button", { name: /แก้ไข/ })).not.toBeInTheDocument();
            fireEvent.click(screen.getByRole("button", { name: "ปิดรายละเอียด" }));
        }
        expect(edit).not.toHaveBeenCalled();
    });

    it("retains the existing edit callback only when authorized", () => {
        const edit = vi.fn();
        const { rerender } = render(<EmployeeTable employees={[employee]} canUpdateEmployees onEditEmployee={edit} />);
        for (const container of [screen.getByRole("table"), screen.getByRole("article")]) {
            fireEvent.click(within(container).getByRole("button", { name: /แก้ไขข้อมูล/ }));
            expect(edit).toHaveBeenLastCalledWith(employee);
        }
        rerender(<EmployeeTable employees={[employee]} canUpdateEmployees />);
        expect(screen.queryByRole("button", { name: /แก้ไข/ })).not.toBeInTheDocument();
    });
});
