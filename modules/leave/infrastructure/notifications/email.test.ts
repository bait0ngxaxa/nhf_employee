import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
    LeaveCancelledAfterApprovalPayload,
    LeaveNotTakenConfirmedPayload,
} from "../../application/notifications/notification-payloads";
import {
    sendLeaveActionNotification,
    sendLeaveResultNotification,
    sendLeaveCancelledNotification,
    sendLeaveCancellationRequestedNotification,
    sendLeaveNotTakenRequestedNotification,
    sendLeaveCancelledAfterApprovalNotification,
    sendLeaveNotTakenConfirmedNotification,
} from "./email";

const sendMailMock = vi.fn();
const verifyMock = vi.fn();
const createTransportMock = vi.fn().mockReturnValue({
    sendMail: sendMailMock,
    verify: verifyMock,
});

vi.mock("nodemailer", () => ({
    default: {
        createTransport: (...args: unknown[]) => createTransportMock(...args),
    },
}));

function buildAdminLeaveDecisionPayload(): LeaveCancelledAfterApprovalPayload {
    return {
        leaveId: "leave-admin-recovery",
        employee: {
            employeeId: 10,
            userId: 1,
            email: "employee@thainhf.org",
            name: "พนักงาน ทดสอบ",
        },
        decisionActorName: "Admin User",
        decisionActorRole: "ADMIN",
        recoveryOverride: true,
        leaveType: "VACATION",
        startDate: "2031-05-05T00:00:00.000Z",
        endDate: "2031-05-05T00:00:00.000Z",
        period: "FULL_DAY",
        durationDays: 1,
    };
}

describe("Leave email notifications", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("EMAIL_PROVIDER", "smtp");
        process.env.SMTP_USER = "user";
        process.env.SMTP_PASS = "pass";
        process.env.SMTP_HOST = "smtp.test";
        process.env.SMTP_PORT = "587";
        verifyMock.mockResolvedValue(true);
        sendMailMock.mockResolvedValue({ messageId: "123" });
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    describe("sendLeaveActionNotification", () => {
        const payload = {
            leaveId: "leave-1",
            deliveryIdentity: "leave-1:20",
            employee: {
                employeeId: 10,
                userId: 100,
                email: "employee@thainhf.org",
                name: "พนักงาน ทดสอบ",
            },
            approver: {
                employeeId: 20,
                userId: 200,
                email: "approver@thainhf.org",
                name: "ผู้อนุมัติ เดิม",
            },
            leaveType: "VACATION" as const,
            startDate: "2031-05-05T00:00:00.000Z",
            endDate: "2031-05-05T00:00:00.000Z",
            period: "FULL_DAY" as const,
            durationDays: 1,
            reason: "พักร้อน",
            emergencyReason: null,
            specialReason: null,
            overQuotaDays: 0,
        };

        it("reuses Message-ID when retrying the same approver", async () => {
            await sendLeaveActionNotification(payload, "https://example.test");
            await sendLeaveActionNotification(payload, "https://example.test");

            expect(sendMailMock).toHaveBeenCalledWith(
                expect.objectContaining({
                    from: '"NHFapp | ระบบวันลา" <user>',
                }),
            );
            const firstMessageId = sendMailMock.mock.calls[0][0].messageId;
            const retryMessageId = sendMailMock.mock.calls[1][0].messageId;
            expect(retryMessageId).toBe(firstMessageId);
            expect(firstMessageId).toContain("-200@");
        });

        it("changes Message-ID when the approver changes", async () => {
            await sendLeaveActionNotification(payload, "https://example.test");
            await sendLeaveActionNotification({
                ...payload,
                deliveryIdentity: "leave-1:30",
                approver: {
                    ...payload.approver,
                    employeeId: 30,
                    userId: 300,
                    email: "new-approver@thainhf.org",
                },
            }, "https://example.test");

            const previousMessageId = sendMailMock.mock.calls[0][0].messageId;
            const nextMessageId = sendMailMock.mock.calls[1][0].messageId;
            expect(nextMessageId).not.toBe(previousMessageId);
            expect(nextMessageId).toContain("-300@");
        });
    });

    it.each([
        ["action", "มีคำขอลาใหม่รออนุมัติ", "ตรวจสอบคำขอ"],
        ["approved", "คำขอลาได้รับการอนุมัติ", "เปิดรายละเอียด"],
        ["rejected", "คำขอลาไม่ได้รับการอนุมัติ", "เปิดรายละเอียด"],
        ["cancelled", "คำขอลาถูกยกเลิก", "เปิดรายละเอียด"],
        ["cancellationRequested", "มีคำขอยกเลิกวันลารอยืนยัน", "ตรวจสอบคำขอ"],
        ["cancelledAfterApproval", "ยืนยันการยกเลิกวันลาแล้ว", "เปิดรายละเอียด"],
        ["notTakenRequested", "มีรายการแจ้งไม่ได้ใช้วันลารอยืนยัน", "ตรวจสอบคำขอ"],
        ["notTakenConfirmed", "ยืนยันไม่ได้ใช้วันลาแล้ว", "เปิดรายละเอียด"],
    ] as const)("uses matching subject and heading for %s", async (event, title, action) => {
        const base = buildAdminLeaveDecisionPayload();
        const request = { ...base, approver: { employeeId: 20, userId: 2, email: "manager@thainhf.org", name: "ผู้อนุมัติ" }, note: "เหตุผล" };
        switch (event) {
            case "action": await sendLeaveActionNotification({ ...request, reason: "พักผ่อน", emergencyReason: null, specialReason: null, overQuotaDays: 0 }, "https://app.example.com/review"); break;
            case "approved": case "rejected": await sendLeaveResultNotification({ ...base, status: event === "approved" ? "APPROVED" : "REJECTED", approverName: "ผู้อนุมัติ", reason: null }); break;
            case "cancelled": await sendLeaveCancelledNotification(request); break;
            case "cancellationRequested": await sendLeaveCancellationRequestedNotification(request); break;
            case "cancelledAfterApproval": await sendLeaveCancelledAfterApprovalNotification(base); break;
            case "notTakenRequested": await sendLeaveNotTakenRequestedNotification(request); break;
            case "notTakenConfirmed": await sendLeaveNotTakenConfirmedNotification(base); break;
        }
        const mail = sendMailMock.mock.calls[0]?.[0];
        expect(mail).toMatchObject({ from: '"NHFapp | ระบบวันลา" <user>', subject: `[NHFapp][Leave] ${title}` });
        expect(mail.html).toContain(title);
        expect(mail.html).toContain(action);
        expect(mail.html).toContain("NHFapp&nbsp; | &nbsp;วันลา");
        expect(mail.html).toContain("หากปุ่มเปิดไม่ได้");
        expect(mail.text).not.toMatch(/APPROVED|REJECTED/);
        expect(mail.text).toContain("กรุณาอย่าตอบกลับ");
    });

    describe("leave recovery decision notifications", () => {
        it("includes the admin actor in approved-leave cancellation email", async () => {
            await sendLeaveCancelledAfterApprovalNotification(
                buildAdminLeaveDecisionPayload(),
            );

            expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
                text: expect.stringContaining(
                    "ผู้ดูแลระบบ Admin User ยืนยันการยกเลิกวันลาที่อนุมัติแล้ว",
                ),
                html: expect.stringContaining(
                    "ผู้ดูแลระบบ Admin User ยืนยันการยกเลิกวันลาที่อนุมัติแล้ว",
                ),
            }));
        });

        it("includes the admin actor in not-taken confirmation email", async () => {
            const payload: LeaveNotTakenConfirmedPayload =
                buildAdminLeaveDecisionPayload();

            await sendLeaveNotTakenConfirmedNotification(payload);

            expect(sendMailMock).toHaveBeenCalledWith(expect.objectContaining({
                text: expect.stringContaining(
                    "ผู้ดูแลระบบ Admin User ยืนยันไม่ได้ใช้วันลาแล้ว",
                ),
                html: expect.stringContaining(
                    "ผู้ดูแลระบบ Admin User ยืนยันว่าคุณไม่ได้ใช้วันลาตามคำขอนี้แล้ว",
                ),
            }));
        });
    });
});
