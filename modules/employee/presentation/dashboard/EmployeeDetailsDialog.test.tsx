import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

function openDetails(container: HTMLElement = screen.getByRole("table")): HTMLButtonElement {
    const trigger = within(container).getByRole<HTMLButtonElement>("button", { name: /ดูรายละเอียด/ });
    trigger.focus();
    fireEvent.click(trigger);
    return trigger;
}

function detailValue(label: string): HTMLElement {
    const term = within(screen.getByRole("dialog")).getByText(label, { selector: "dt" });
    const value = term.nextElementSibling;
    if (!(value instanceof HTMLElement)) throw new Error(`Missing detail: ${label}`);
    return value;
}

describe("EmployeeDetailsDialog", () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("opens the correct complete profile without exposing account data", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-11-04T05:00:00Z"));
        const other = { ...employee, id: 2, firstName: "คนอื่น", email: "other@example.com" };
        render(<EmployeeTable employees={[other, { ...employee, hireDate: "2023-04-01", user: { id: 99, email: "private@example.com", role: "ADMIN" } }]} canUpdateEmployees={false} />);
        fireEvent.click(within(screen.getByRole("table")).getAllByRole("button", { name: /ดูรายละเอียด/ })[1]);
        const dialog = screen.getByRole("dialog", { name: `${employee.firstName} ${employee.lastName}` });
        expect(dialog).toHaveAccessibleDescription("รายละเอียดข้อมูลส่วนตัว การติดต่อ และการทำงานของพนักงาน");
        const expected = {
            "ชื่อ": employee.firstName, "นามสกุล": employee.lastName, "ชื่อเล่น": employee.nickname,
            "อีเมล": employee.email, "เบอร์โทร": "081-2345678", "ตำแหน่ง": employee.position,
            "แผนก": employee.dept.name, "สังกัด": employee.affiliation, "วันที่เริ่มงาน": "01/04/2566",
            "อายุงาน": "3 ปี 7 เดือน 3 วัน", "สถานะ": "ทำงานอยู่",
        };
        for (const [label, value] of Object.entries(expected)) expect(detailValue(label)).toHaveTextContent(value ?? "");
        expect(dialog).not.toHaveTextContent("private@example.com");
        expect(dialog).not.toHaveTextContent("ADMIN");
        expect(dialog).not.toHaveTextContent(other.email);
        expect(detailValue("อีเมล")).toHaveClass("[overflow-wrap:anywhere]");
    });

    it("uses placeholders for missing optional values and never falls back to createdAt", () => {
        render(<EmployeeTable employees={[{ ...employee, nickname: null, phone: null, affiliation: null, hireDate: null, email: "missing@temp.local" }]} canUpdateEmployees={false} />);
        openDetails();
        for (const label of ["ชื่อเล่น", "เบอร์โทร", "สังกัด", "อีเมล"]) expect(detailValue(label)).toHaveTextContent("-");
        expect(detailValue("วันที่เริ่มงาน")).toHaveTextContent("ไม่ระบุ");
        expect(detailValue("อายุงาน")).toHaveTextContent("ยังไม่ทราบ");
        expect(screen.getByRole("dialog")).not.toHaveTextContent("01/01/2563");
        expect(screen.queryByText(/0 ปี/)).not.toBeInTheDocument();
    });

    it.each(["close", "escape"])("closes with %s and restores the original trigger focus", async (method) => {
        render(<EmployeeTable employees={[employee]} canUpdateEmployees={false} />);
        const trigger = openDetails(screen.getByRole("article"));
        if (method === "close") fireEvent.click(screen.getByRole("button", { name: "ปิดรายละเอียด" }));
        else fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        await waitFor(() => expect(trigger).toHaveFocus());
    });

    it("updates at Thailand midnight with one timer and cleans up on close", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-11-04T16:59:59.500Z"));
        render(<EmployeeTable employees={[{ ...employee, hireDate: "2023-04-01" }]} canUpdateEmployees={false} />);
        openDetails();
        expect(detailValue("อายุงาน")).toHaveTextContent("3 ปี 7 เดือน 3 วัน");
        act(() => vi.advanceTimersByTime(500));
        expect(detailValue("อายุงาน")).toHaveTextContent("3 ปี 7 เดือน 4 วัน");
        expect(vi.getTimerCount()).toBe(1);
        fireEvent.click(screen.getByRole("button", { name: "ปิดรายละเอียด" }));
        await act(async () => { await vi.advanceTimersByTimeAsync(1); });
        expect(vi.getTimerCount()).toBe(0);
    });

    it("catches up after a hidden tab returns without polling while hidden", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-11-04T05:00:00Z"));
        const visibility = vi.spyOn(document, "visibilityState", "get");
        render(<EmployeeTable employees={[{ ...employee, hireDate: "2023-04-01" }]} canUpdateEmployees={false} />);
        openDetails();
        await act(async () => { await vi.advanceTimersByTimeAsync(1); });
        visibility.mockReturnValue("hidden");
        fireEvent(document, new Event("visibilitychange"));
        expect(vi.getTimerCount()).toBe(0);
        vi.setSystemTime(new Date("2026-11-06T05:00:00Z"));
        visibility.mockReturnValue("visible");
        fireEvent(document, new Event("visibilitychange"));
        expect(detailValue("อายุงาน")).toHaveTextContent("3 ปี 7 เดือน 5 วัน");
        expect(vi.getTimerCount()).toBe(1);
    });

    it.each(["focus", "pageshow"])("refreshes on %s after a suspended timer", (event) => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-11-04T05:00:00Z"));
        render(<EmployeeTable employees={[{ ...employee, hireDate: "2023-04-01" }]} canUpdateEmployees={false} />);
        openDetails();
        vi.setSystemTime(new Date("2026-11-05T05:00:00Z"));
        fireEvent(window, new Event(event));
        expect(detailValue("อายุงาน")).toHaveTextContent("3 ปี 7 เดือน 4 วัน");
    });

    it("uses refreshed list data when adding, changing and clearing a hire date", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-11-04T05:00:00Z"));
        const { rerender } = render(<EmployeeTable employees={[{ ...employee, hireDate: null }]} canUpdateEmployees={false} />);
        openDetails();
        expect(detailValue("อายุงาน")).toHaveTextContent("ยังไม่ทราบ");
        rerender(<EmployeeTable employees={[{ ...employee, hireDate: "2023-04-01" }]} canUpdateEmployees={false} />);
        expect(detailValue("อายุงาน")).toHaveTextContent("3 ปี 7 เดือน 3 วัน");
        rerender(<EmployeeTable employees={[{ ...employee, hireDate: "2026-11-04", position: "ตำแหน่งใหม่" }]} canUpdateEmployees={false} />);
        expect(detailValue("อายุงาน")).toHaveTextContent("0 ปี 0 เดือน 0 วัน");
        expect(detailValue("ตำแหน่ง")).toHaveTextContent("ตำแหน่งใหม่");
        rerender(<EmployeeTable employees={[{ ...employee, hireDate: null }]} canUpdateEmployees={false} />);
        expect(detailValue("อายุงาน")).toHaveTextContent("ยังไม่ทราบ");
        expect(screen.queryByText(/0 ปี/)).not.toBeInTheDocument();
    });

    it("forgets a removed employee and opens a different employee without stale details", () => {
        const other = { ...employee, id: 2, firstName: "พนักงานอีกคน", email: "other@example.com" };
        const { rerender } = render(<EmployeeTable employees={[employee]} canUpdateEmployees={false} />);
        openDetails();
        rerender(<EmployeeTable employees={[other]} canUpdateEmployees={false} />);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        rerender(<EmployeeTable employees={[employee, other]} canUpdateEmployees={false} />);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        fireEvent.click(within(screen.getByRole("table")).getAllByRole("button", { name: /ดูรายละเอียด/ })[1]);
        expect(detailValue("อีเมล")).toHaveTextContent(other.email);
        expect(screen.getAllByRole("dialog")).toHaveLength(1);
    });
});
