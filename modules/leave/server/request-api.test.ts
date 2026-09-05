// @vitest-environment node

import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

import { LeaveAttachmentValidationError } from "../schemas/attachments";
import { handleLeaveRequestSubmission } from "./request-api";

describe("Leave request HTTP adapter", () => {
    it("returns a safe validation response before persistence when attachment storage rejects", async () => {
        const validationError = new LeaveAttachmentValidationError(
            'ไฟล์ "invalid.jpg" ไม่ใช่รูปภาพที่ถูกต้อง',
        );
        const saveLeaveAttachments = vi.fn().mockRejectedValue(validationError);
        const deleteLeaveAttachment = vi.fn();
        const request = new NextRequest("http://localhost/api/leave/request", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Idempotency-Key": "request-api-validation-test",
            },
            body: JSON.stringify({
                leaveType: "PERSONAL",
                startDate: "2099-05-10",
                endDate: "2099-05-10",
                period: "FULL_DAY",
                reason: "ทดสอบไฟล์แนบไม่ถูกต้อง",
            }),
        });

        const response = await handleLeaveRequestSubmission(
            request,
            {
                userId: 1,
                employeeId: 10,
                userEmail: "employee@example.com",
            },
            undefined,
            undefined,
            undefined,
            { saveLeaveAttachments, deleteLeaveAttachment },
        );

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({
            error: validationError.message,
        });
        expect(deleteLeaveAttachment).not.toHaveBeenCalled();
    });
});
