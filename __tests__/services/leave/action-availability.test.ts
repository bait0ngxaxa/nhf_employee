import { afterEach, describe, expect, it, vi } from "vitest";

import {
    getApproverLeaveActions,
    getEmployeeLeaveActions,
} from "@/lib/services/leave/action-availability";

const BASE_EMPLOYEE_REQUEST = {
    status: "APPROVED" as const,
    startDate: "2026-09-10T00:00:00.000Z",
    endDate: "2026-09-10T00:00:00.000Z",
    cancellationRequestedAt: null,
    notTakenRequestedAt: null,
};

describe("Leave action availability", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("allows only cancellation for a pending employee request", () => {
        expect(getEmployeeLeaveActions({
            ...BASE_EMPLOYEE_REQUEST,
            status: "PENDING",
        })).toEqual(["CANCEL"]);
    });

    it("uses existing business-date rules for approved employee actions", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-09-01T05:00:00.000Z"));
        expect(getEmployeeLeaveActions(BASE_EMPLOYEE_REQUEST)).toEqual([
            "REQUEST_CANCELLATION",
        ]);

        vi.setSystemTime(new Date("2026-09-12T05:00:00.000Z"));
        expect(getEmployeeLeaveActions(BASE_EMPLOYEE_REQUEST)).toEqual([
            "REQUEST_NOT_TAKEN",
        ]);
    });

    it("does not expose actions after a request was already raised", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-09-12T05:00:00.000Z"));

        expect(getEmployeeLeaveActions({
            ...BASE_EMPLOYEE_REQUEST,
            notTakenRequestedAt: "2026-09-12T00:00:00.000Z",
        })).toEqual([]);
    });

    it("allows cancellation confirmation before the Leave start date", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-09-09T05:00:00.000Z"));

        expect(getApproverLeaveActions({
            status: "CANCELLATION_REQUESTED",
            startDate: "2026-09-10T00:00:00.000Z",
            notTakenRequestedAt: null,
            notTakenConfirmedAt: null,
        })).toEqual(["CONFIRM_CANCELLATION", "REJECT_CANCELLATION"]);
    });

    it("only allows rejecting cancellation on or after the Leave start date", () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-09-10T05:00:00.000Z"));

        expect(getApproverLeaveActions({
            status: "CANCELLATION_REQUESTED",
            startDate: "2026-09-10T00:00:00.000Z",
            notTakenRequestedAt: null,
            notTakenConfirmedAt: null,
        })).toEqual(["REJECT_CANCELLATION"]);
    });

    it.each([
        ["PENDING", null, null, ["APPROVE", "REJECT"]],
        ["APPROVED", "2026-09-12T00:00:00.000Z", null, ["CONFIRM_NOT_TAKEN"]],
        ["REJECTED", null, null, []],
        ["APPROVED", "2026-09-12T00:00:00.000Z", "2026-09-13T00:00:00.000Z", []],
    ] as const)(
        "maps actionable approver state %s without role shortcuts",
        (status, notTakenRequestedAt, notTakenConfirmedAt, expected) => {
            expect(getApproverLeaveActions({
                status,
                startDate: BASE_EMPLOYEE_REQUEST.startDate,
                notTakenRequestedAt,
                notTakenConfirmedAt,
            })).toEqual(expected);
        },
    );
});
