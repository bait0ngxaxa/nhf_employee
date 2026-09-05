import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LeaveQuotaCards } from "./LeaveQuotaCards";
import type { LeaveQuotaBalance } from "../hooks/useLeaveProfile";

const SICK_QUOTA: LeaveQuotaBalance = {
    totalDays: 30,
    carryBalanceDays: 0,
    effectiveTotalDays: 30,
    usedDays: 20,
    remainingDays: 10,
};

function renderCards(
    personalQuota: LeaveQuotaBalance,
    vacationQuota: LeaveQuotaBalance = {
        totalDays: 6,
        carryBalanceDays: 0,
        effectiveTotalDays: 6,
        usedDays: 0,
        remainingDays: 6,
    },
): void {
    render(
        <LeaveQuotaCards
            sickQuota={SICK_QUOTA}
            personalQuota={personalQuota}
            vacationQuota={vacationQuota}
        />,
    );
}

describe("LeaveQuotaCards", () => {
    it("shows positive carry and the authoritative remaining balance", () => {
        renderCards({
            totalDays: 10,
            carryBalanceDays: 7,
            effectiveTotalDays: 17,
            usedDays: 5,
            remainingDays: 12,
        });

        const personalCard = screen.getByText("ลากิจ").closest("[data-slot='card']");
        if (!(personalCard instanceof HTMLElement)) {
            throw new Error("ไม่พบการ์ดโควต้าลากิจ");
        }
        expect(within(personalCard).getByText("ยอดยกมา +7 วัน")).toBeInTheDocument();
        expect(within(personalCard).getByText("12")).toBeInTheDocument();
        expect(within(personalCard).getByText("วันคงเหลือ")).toBeInTheDocument();
    });

    it("explains negative carry as prior over-quota usage", () => {
        renderCards({
            totalDays: 10,
            carryBalanceDays: -2,
            effectiveTotalDays: 8,
            usedDays: 7,
            remainingDays: 1,
        });

        expect(screen.getByText("ยอดเกินสิทธิ์ยกมา -2 วัน")).toBeInTheDocument();
    });

    it("renders negative effective entitlement without invalid progress values", () => {
        renderCards({
            totalDays: 10,
            carryBalanceDays: -12,
            effectiveTotalDays: -2,
            usedDays: 0,
            remainingDays: -2,
        });

        const progress = screen.getByRole("progressbar", {
            name: "ใช้วันลาไปแล้ว 0 วัน โดยสิทธิรวมไม่เป็นบวก",
        });
        expect(progress).toHaveAttribute("aria-valuenow", "100");
        expect(progress.firstElementChild).toHaveStyle({ width: "100%" });
        expect(screen.getByText("วันเกินสิทธิ์")).toBeInTheDocument();
        expect(document.body.innerHTML).not.toContain("NaN");
    });

    it("fills the secondary progress bar when usage grows from non-positive entitlement", () => {
        renderCards({
            totalDays: 10,
            carryBalanceDays: -12,
            effectiveTotalDays: -2,
            usedDays: 1,
            remainingDays: -3,
        });

        const progress = screen.getByRole("progressbar", {
            name: "ใช้วันลาไปแล้ว 1 วัน โดยสิทธิรวมไม่เป็นบวก",
        });
        expect(progress).toHaveAttribute("aria-valuenow", "100");
        expect(progress.firstElementChild).toHaveStyle({ width: "100%" });
    });
});
