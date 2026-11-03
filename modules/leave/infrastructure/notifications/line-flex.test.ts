import { afterEach, describe, expect, it, vi } from "vitest";

import {
    generateLeaveActionFlexMessage,
    generateLeaveCancelledAfterApprovalFlexMessage,
    generateLeaveCancelledFlexMessage,
    generateLeaveCancellationRequestedFlexMessage,
    generateLeaveNotTakenConfirmedFlexMessage,
    generateLeaveNotTakenRequestedFlexMessage,
    generateLeaveResultFlexMessage,
} from "./line-flex";
import type {
    LeaveActionPayload,
    LeaveCancelledAfterApprovalPayload,
    LeaveCancelledPayload,
    LeaveCancellationRequestedPayload,
    LeaveNotTakenConfirmedPayload,
    LeaveNotTakenRequestedPayload,
    LeaveResultPayload,
} from "../../application/notifications/notification-payloads";
import { NOTIFICATION_STATUS_COLORS } from "@/shared/notifications/presentation";
import { validateNotificationFlexMessage } from "@/__tests__/lib/notification-flex-contract";

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
const actionUrls = {
    history: "https://liff.line.me/nhfapp-liff-id/leave/history",
    review: "https://liff.line.me/nhfapp-liff-id/leave/review",
    result: "https://liff.line.me/nhfapp-liff-id/leave/history?result=1",
    cancelled: "https://liff.line.me/nhfapp-liff-id/leave/history?cancelled=1",
    notTaken: "https://liff.line.me/nhfapp-liff-id/leave/history?notTaken=1",
} as const;

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
            actionUrls.history,
        );

        expect(JSON.stringify(message)).toContain("คำขอลาไม่ได้รับการอนุมัติ");
        expect(JSON.stringify(message)).toContain("สถานะ: ไม่อนุมัติ");
    });

    it.each([
        [generateLeaveActionFlexMessage(buildActionPayload(), actionUrls.review), "มีคำขอลาใหม่รออนุมัติ", "ตรวจสอบคำขอ"],
        [generateLeaveResultFlexMessage(buildResultPayload(), actionUrls.history), "คำขอลาได้รับการอนุมัติ", "เปิดรายละเอียด"],
        [generateLeaveResultFlexMessage({ ...buildResultPayload(), status: "REJECTED" }, actionUrls.history), "คำขอลาไม่ได้รับการอนุมัติ", "เปิดรายละเอียด"],
        [generateLeaveCancelledFlexMessage(buildCancelledPayload(), actionUrls.history), "คำขอลาถูกยกเลิก", "เปิดรายละเอียด"],
        [generateLeaveCancellationRequestedFlexMessage(buildCancellationRequestedPayload(), actionUrls.review), "มีคำขอยกเลิกวันลารอยืนยัน", "ตรวจสอบคำขอ"],
        [generateLeaveCancelledAfterApprovalFlexMessage(buildCancelledAfterApprovalPayload(), actionUrls.history), "ยืนยันการยกเลิกวันลาแล้ว", "เปิดรายละเอียด"],
        [generateLeaveNotTakenRequestedFlexMessage(buildNotTakenRequestedPayload(), actionUrls.review), "มีรายการแจ้งไม่ได้ใช้วันลารอยืนยัน", "ตรวจสอบคำขอ"],
        [generateLeaveNotTakenConfirmedFlexMessage(buildNotTakenConfirmedPayload(), actionUrls.history), "ยืนยันไม่ได้ใช้วันลาแล้ว", "เปิดรายละเอียด"],
    ] as const)("uses the canonical event title, privacy-safe preview and CTA", (message, title, action) => {
        expect(validateNotificationFlexMessage(message)).toEqual([]);
        expect(message.altText).toBe(`วันลา: ${title}`);
        expect(message.contents.header?.contents[0]).toMatchObject({ text: "NHFapp | วันลา · คำขอลา" });
        expect(message.contents.body?.contents[0]).toMatchObject({ text: title });
        expect(message.contents.footer?.contents[0]).toMatchObject({ action: { label: action } });
        const button = message.contents.footer?.contents[0];
        expect(button).toMatchObject({ action: { uri: expect.stringMatching(/^https:\/\//) } });
        expect(message.altText).not.toContain(employee.name);
    });

    it.each([
        ["result", generateLeaveResultFlexMessage(buildResultPayload(), actionUrls.result), actionUrls.result],
        ["cancelled", generateLeaveCancelledFlexMessage(buildCancelledPayload(), actionUrls.cancelled), actionUrls.cancelled],
        ["cancellation request", generateLeaveCancellationRequestedFlexMessage(buildCancellationRequestedPayload(), actionUrls.review), actionUrls.review],
        ["cancelled after approval", generateLeaveCancelledAfterApprovalFlexMessage(buildCancelledAfterApprovalPayload(), actionUrls.history), actionUrls.history],
        ["not-taken request", generateLeaveNotTakenRequestedFlexMessage(buildNotTakenRequestedPayload(), actionUrls.notTaken), actionUrls.notTaken],
        ["not-taken confirmation", generateLeaveNotTakenConfirmedFlexMessage(buildNotTakenConfirmedPayload(), actionUrls.history), actionUrls.history],
    ])("keeps the CTA supplied by the Leave LIFF flow for %s", (_label, message, expectedUrl) => {
        expect(getButtonUri(message)).toBe(expectedUrl);
    });

    it.each([
        ["approval requested", generateLeaveActionFlexMessage(buildActionPayload(), actionUrls.review), "warning"],
        ["approved", generateLeaveResultFlexMessage(buildResultPayload(), actionUrls.history), "success"],
        ["rejected", generateLeaveResultFlexMessage({ ...buildResultPayload(), status: "REJECTED" }, actionUrls.history), "danger"],
        ["cancelled", generateLeaveCancelledFlexMessage(buildCancelledPayload(), actionUrls.history), "neutral"],
        ["cancellation requested", generateLeaveCancellationRequestedFlexMessage(buildCancellationRequestedPayload(), actionUrls.review), "warning"],
        ["cancelled after approval", generateLeaveCancelledAfterApprovalFlexMessage(buildCancelledAfterApprovalPayload(), actionUrls.history), "neutral"],
        ["not-taken requested", generateLeaveNotTakenRequestedFlexMessage(buildNotTakenRequestedPayload(), actionUrls.notTaken), "warning"],
        ["not-taken confirmed", generateLeaveNotTakenConfirmedFlexMessage(buildNotTakenConfirmedPayload(), actionUrls.history), "neutral"],
    ] as const)("uses the typed semantic color for %s", (_label, message, status) => {
        expect(message.contents.body?.contents[0]).toMatchObject({
            color: NOTIFICATION_STATUS_COLORS[status],
        });

        const statusRow = message.contents.body?.contents.find(
            (content) => content.type === "text" && content.text.startsWith("สถานะ:"),
        );
        if (statusRow) {
            expect(statusRow).toMatchObject({ color: NOTIFICATION_STATUS_COLORS[status] });
        }
    });
});
