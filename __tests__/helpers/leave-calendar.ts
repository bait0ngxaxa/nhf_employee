import { fireEvent } from "@testing-library/react";

export function chooseLeaveDate(date: string, confirm = true): void {
    const section = document.querySelector('[aria-label="เลือกวันที่ลา"]');
    if (!section) throw new Error("Leave calendar missing");
    const target = date.slice(0, 7);
    if (section.getAttribute("data-calendar-month") !== target) {
        const yearSelector = section.querySelector('[aria-label="เลือกปี พ.ศ."]');
        const monthSelector = section.querySelector('[aria-label="เลือกเดือน"]');
        if (!yearSelector || !monthSelector) throw new Error("Calendar navigation missing");
        fireEvent.change(yearSelector, { target: { value: date.slice(0, 4) } });
        fireEvent.change(monthSelector, { target: { value: String(Number(date.slice(5, 7)) - 1) } });
    }
    const day = section.querySelector(`[data-day="${date}"] button`);
    if (!day) throw new Error(`Calendar date missing: ${date}`);
    fireEvent.click(day);
    const confirmation = [...section.querySelectorAll("button")].find((button) => button.textContent === "ยืนยันวันที่ลา");
    if (confirm && confirmation) fireEvent.click(confirmation);
}
