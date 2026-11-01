import { fireEvent } from "@testing-library/react";

export function chooseLeaveDate(date: string, confirm = true): void {
    const section = document.querySelector('[aria-label="เลือกวันที่ลา"]');
    if (!section) throw new Error("Leave calendar missing");
    const target = date.slice(0, 7);
    for (let index = 0; index < 1200; index++) {
        const month = section.getAttribute("data-calendar-month") ?? "";
        if (month === target) break;
        const navigation = section.querySelector(`[aria-label="${month < target ? "เดือนถัดไป" : "เดือนก่อนหน้า"}"]`);
        if (!navigation) throw new Error("Calendar navigation missing");
        fireEvent.click(navigation);
    }
    const day = section.querySelector(`[data-day="${date}"] button`);
    if (!day) throw new Error(`Calendar date missing: ${date}`);
    fireEvent.click(day);
    const confirmation = [...section.querySelectorAll("button")].find((button) => button.textContent === "ยืนยันวันที่ลา");
    if (confirm && confirmation) fireEvent.click(confirmation);
}
