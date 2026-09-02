import { afterEach, describe, expect, it, vi } from "vitest";

import {
    generateLeaveActionFlexMessage,
    generateLeaveCancelledAfterApprovalFlexMessage,
    generateLeaveCancelledFlexMessage,
    generateLeaveCancellationRequestedFlexMessage,
    generateLeaveNotTakenConfirmedFlexMessage,
    generateLeaveNotTakenRequestedFlexMessage,
    generateLeaveResultFlexMessage,
} from "@/lib/line/flex-messages/leave";
import type {
    LeaveActionPayload,
    LeaveCancelledAfterApprovalPayload,
    LeaveCancelledPayload,
    LeaveCancellationRequestedPayload,
    LeaveNotTakenConfirmedPayload,
    LeaveNotTakenRequestedPayload,
    LeaveResultPayload,
} from "@/lib/services/leave/notification-payloads";

const employee = {
    employeeId: 10,
    userId: 1,
    email: "employee@example.com",
    name: "สมชาย ใจดี",
};
const approver = {
    employeeId: 20,
    userId: 2,
    email: "manager@example.com",
    name: "ผู้จัดการ ใจดี",
};
const leaveDetails = {
    leaveId: "leave-1",
    leaveType: "VACATION" as const,
    startDate: "2026-07-01T00:00:00.000Z",
    endDate: "2026-07-02T00:00:00.000Z",
    period: "FULL_DAY" as const,
    durationDays: 2,
};

function buildActionPayload(): LeaveActionPayload {
    return {
        ...leaveDetails,
        employee,
        approver,
        reason: "พักผ่อน",
        emergencyReason: null,
        specialReason: null,
        overQuotaDays: 0,
    };
}

function buildResultPayload(): LeaveResultPayload {
    return {
        ...leaveDetails,
        employee,
        approverName: approver.name,
        status: "APPROVED",
        reason: null,
    };
}

function buildCancelledPayload(): LeaveCancelledPayload {
    return { ...leaveDetails, employee, approver };
}

function buildCancellationRequestedPayload(): LeaveCancellationRequestedPayload {
    return { ...leaveDetails, employee, approver, note: "มีเหตุจำเป็น" };
}

function buildCancelledAfterApprovalPayload(): LeaveCancelledAfterApprovalPayload {
    return {
        ...leaveDetails,
        employee,
        decisionActorName: approver.name,
        decisionActorRole: "USER",
        recoveryOverride: false,
    };
}

function buildNotTakenRequestedPayload(): LeaveNotTakenRequestedPayload {
    return { ...leaveDetails, employee, approver, note: "ไม่ได้ใช้วันลา" };
}

function buildNotTakenConfirmedPayload(): LeaveNotTakenConfirmedPayload {
    return {
        ...leaveDetails,
        employee,
        decisionActorName: approver.name,
        decisionActorRole: "USER",
        recoveryOverride: false,
    };
}

function getButtonUri(message: ReturnType<typeof generateLeaveActionFlexMessage>): string {
    const button = message.contents.footer?.contents[0];
    if (!button || button.type !== "button") {
        throw new Error("Leave Flex message CTA is missing");
    }
    return button.action.uri;
}

describe("Leave LINE Flex messages", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("uses the Leave LIFF approve action for a new request", () => {
        vi.stubEnv("NEXT_PUBLIC_LINE_LIFF_ID", "nhfapp-liff-id");

        const message = generateLeaveActionFlexMessage(
            buildActionPayload(),
            "https://liff.line.me/nhfapp-liff-id/leave?requestId=leave-1&action=approve",
        );

        expect(getButtonUri(message)).toContain("action=approve");
        expect(JSON.stringify(message)).toContain("สมชาย ใจดี");
        expect(JSON.stringify(message)).toContain("ลาพักร้อน");
    });

    it("renders a rejected result for the employee", () => {
        const message = generateLeaveResultFlexMessage(
            {
                ...buildResultPayload(),
                status: "REJECTED",
                reason: "ติดภารกิจ",
            },
            "history-url",
        );

        expect(JSON.stringify(message)).toContain("คำขอลาไม่ได้รับการอนุมัติ");
        expect(JSON.stringify(message)).toContain("สถานะ: ไม่อนุมัติ");
    });

    it.each([
        ["result", generateLeaveResultFlexMessage(buildResultPayload(), "result-url"), "result-url"],
        ["cancelled", generateLeaveCancelledFlexMessage(buildCancelledPayload(), "cancel-url"), "cancel-url"],
        ["cancellation request", generateLeaveCancellationRequestedFlexMessage(buildCancellationRequestedPayload(), "review-url"), "review-url"],
        ["cancelled after approval", generateLeaveCancelledAfterApprovalFlexMessage(buildCancelledAfterApprovalPayload(), "history-url"), "history-url"],
        ["not-taken request", generateLeaveNotTakenRequestedFlexMessage(buildNotTakenRequestedPayload(), "not-taken-url"), "not-taken-url"],
        ["not-taken confirmation", generateLeaveNotTakenConfirmedFlexMessage(buildNotTakenConfirmedPayload(), "history-url"), "history-url"],
    ])("keeps the CTA supplied by the Leave LIFF flow for %s", (_label, message, expectedUrl) => {
        expect(getButtonUri(message)).toBe(expectedUrl);
    });
});
