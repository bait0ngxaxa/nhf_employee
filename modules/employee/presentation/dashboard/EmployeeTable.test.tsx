import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

describe("EmployeeTable", () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("keeps full names and email addresses on one line without truncation", () => {
        render(
            <EmployeeTable
                employees={[employee]}
                canUpdateEmployees={true}
                onEditEmployee={() => undefined}
            />,
        );

        const fullName = "นางสาวสมใจ นามสกุลยาวเพื่อทดสอบการแสดงผล (สมใจ)";
        const table = screen.getByRole("table");
        const fullNameValue = within(table).getByText(fullName);
        const emailValue = within(table).getByText(employee.email);
        expect(within(table).getByRole("button", {
            name: `แก้ไขข้อมูล ${fullName}`,
        })).toBeInTheDocument();

        [fullNameValue, emailValue].forEach((value) => {
            expect(value).toHaveClass("whitespace-nowrap");
            expect(value).not.toHaveClass("truncate");
        });
    });

    it("hides desktop and mobile edit controls without update capability", () => {
        render(
            <EmployeeTable
                employees={[employee]}
                canUpdateEmployees={false}
                onEditEmployee={() => undefined}
            />,
        );

        const fullName = "นางสาวสมใจ นามสกุลยาวเพื่อทดสอบการแสดงผล (สมใจ)";
        expect(screen.getByRole("table")).not.toHaveTextContent("การจัดการ");
        expect(screen.queryByRole("button", {
            name: `แก้ไขข้อมูล ${fullName}`,
        })).not.toBeInTheDocument();
    });

    it("shows the same known hire date and calculated tenure on desktop and mobile", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-11-04T05:00:00.000Z"));

        render(
            <EmployeeTable
                employees={[{ ...employee, hireDate: "2023-04-01" }]}
                canUpdateEmployees={false}
            />,
        );

        const table = screen.getByRole("table");
        const card = screen.getByRole("article");
        expect(within(table).getByText("01/04/2566")).toBeInTheDocument();
        expect(within(table).getByText("3 ปี 7 เดือน 3 วัน")).toBeInTheDocument();
        expect(within(card).getByText("01/04/2566")).toBeInTheDocument();
        expect(within(card).getByText("3 ปี 7 เดือน 3 วัน")).toBeInTheDocument();
    });

    it("shows unknown hire date and tenure instead of zero for null dates", () => {
        render(
            <EmployeeTable
                employees={[{ ...employee, hireDate: null }]}
                canUpdateEmployees={false}
            />,
        );

        const table = screen.getByRole("table");
        const card = screen.getByRole("article");
        expect(within(table).getByText("ไม่ระบุ")).toBeInTheDocument();
        expect(within(table).getByText("ยังไม่ทราบ")).toBeInTheDocument();
        expect(within(card).getByText("ไม่ระบุ")).toBeInTheDocument();
        expect(within(card).getByText("ยังไม่ทราบ")).toBeInTheDocument();
        expect(screen.queryByText(/0 ปี/)).not.toBeInTheDocument();
    });

    it("updates desktop and mobile at Thailand midnight with a single timer", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-11-04T16:59:59.500Z"));
        const { unmount } = render(
            <EmployeeTable employees={[{ ...employee, hireDate: "2023-04-01" }]} canUpdateEmployees={false} />,
        );
        expect(screen.getAllByText("3 ปี 7 เดือน 3 วัน")).toHaveLength(2);
        expect(vi.getTimerCount()).toBe(1);
        act(() => vi.advanceTimersByTime(500));
        expect(screen.getAllByText("3 ปี 7 เดือน 4 วัน")).toHaveLength(2);
        expect(vi.getTimerCount()).toBe(1);
        unmount();
        expect(vi.getTimerCount()).toBe(0);
    });

    it("catches up after a hidden tab returns without polling while hidden", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-11-04T05:00:00Z"));
        const visibility = vi.spyOn(document, "visibilityState", "get");
        render(<EmployeeTable employees={[{ ...employee, hireDate: "2023-04-01" }]} canUpdateEmployees={false} />);
        visibility.mockReturnValue("hidden");
        fireEvent(document, new Event("visibilitychange"));
        expect(vi.getTimerCount()).toBe(0);
        vi.setSystemTime(new Date("2026-11-06T05:00:00Z"));
        visibility.mockReturnValue("visible");
        fireEvent(document, new Event("visibilitychange"));
        expect(screen.getAllByText("3 ปี 7 เดือน 5 วัน")).toHaveLength(2);
        expect(vi.getTimerCount()).toBe(1);
    });

    it.each(["focus", "pageshow"])("refreshes on %s after a suspended timer", (event) => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-11-04T05:00:00Z"));
        render(<EmployeeTable employees={[{ ...employee, hireDate: "2023-04-01" }]} canUpdateEmployees={false} />);
        vi.setSystemTime(new Date("2026-11-05T05:00:00Z"));
        fireEvent(window, new Event(event));
        expect(screen.getAllByText("3 ปี 7 เดือน 4 วัน")).toHaveLength(2);
    });

    it("recalculates both layouts after adding, changing and clearing a date", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-11-04T05:00:00Z"));
        const { rerender } = render(<EmployeeTable employees={[{ ...employee, hireDate: null }]} canUpdateEmployees={false} />);
        expect(screen.getAllByText("ยังไม่ทราบ")).toHaveLength(2);
        rerender(<EmployeeTable employees={[{ ...employee, hireDate: "2023-04-01" }]} canUpdateEmployees={false} />);
        expect(screen.getAllByText("3 ปี 7 เดือน 3 วัน")).toHaveLength(2);
        rerender(<EmployeeTable employees={[{ ...employee, hireDate: "2026-11-04" }]} canUpdateEmployees={false} />);
        expect(screen.getAllByText("0 ปี 0 เดือน 0 วัน")).toHaveLength(2);
        rerender(<EmployeeTable employees={[{ ...employee, hireDate: null }]} canUpdateEmployees={false} />);
        expect(screen.getAllByText("ยังไม่ทราบ")).toHaveLength(2);
        expect(screen.queryByText(/0 ปี/)).not.toBeInTheDocument();
    });
});
