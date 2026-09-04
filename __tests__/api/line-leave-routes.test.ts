// @vitest-environment node
import type * as NextServerModule from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    requireLiffWorkforceSession: vi.fn(),
    getEmployeeLeaveProfile: vi.fn(),
    getLeaveApprovalList: vi.fn(),
    getAuthorizedLeaveDetail: vi.fn(),
    getAuthorizedLeaveAttachment: vi.fn(),
    readLeaveAttachment: vi.fn(),
    handleLeaveRequestSubmission: vi.fn(),
    createLeaveRequestErrorResponse: vi.fn(),
    handleLeaveNotTakenRequest: vi.fn(),
    handleLeaveNotTakenConfirmation: vi.fn(),
    cancelLeaveRequest: vi.fn(),
    confirmLeaveCancellation: vi.fn(),
    rejectLeaveCancellation: vi.fn(),
    decideLeaveRequest: vi.fn(),
    processOutbox: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => {
    const actual = await importOriginal<typeof NextServerModule>();
    return { ...actual, after: vi.fn((callback: () => void) => callback()) };
});

vi.mock("@/lib/auth/liff", () => ({
    requireLiffWorkforceSession: mocks.requireLiffWorkforceSession,
}));
vi.mock("@/modules/leave", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...(actual as Record<string, unknown>),
        getEmployeeLeaveProfile: mocks.getEmployeeLeaveProfile,
        getLeaveApprovalList: mocks.getLeaveApprovalList,
        getAuthorizedLeaveDetail: mocks.getAuthorizedLeaveDetail,
        getAuthorizedLeaveAttachment: mocks.getAuthorizedLeaveAttachment,
        readLeaveAttachment: mocks.readLeaveAttachment,
        handleLeaveRequestSubmission: mocks.handleLeaveRequestSubmission,
        createLeaveRequestErrorResponse: mocks.createLeaveRequestErrorResponse,
        handleLeaveNotTakenRequest: mocks.handleLeaveNotTakenRequest,
        handleLeaveNotTakenConfirmation: mocks.handleLeaveNotTakenConfirmation,
        cancelLeaveRequest: mocks.cancelLeaveRequest,
        confirmLeaveCancellation: mocks.confirmLeaveCancellation,
        rejectLeaveCancellation: mocks.rejectLeaveCancellation,
        decideLeaveRequest: mocks.decideLeaveRequest,
    };
});
vi.mock("@/lib/services/outbox/processor", () => ({
    processOutbox: mocks.processOutbox,
}));
vi.mock("@/lib/security/mutation-rate-limit", () => ({
    enforcePreAuthIpRateLimit: vi.fn(() => null),
    enforceAuthenticatedMutationRateLimit: vi.fn(() => null),
}));

import { GET as getApprovals } from "@/app/api/line/leave/approvals/route";
import { GET as getAttachment } from "@/app/api/line/leave/attachments/[id]/route";
import { POST as cancelLeave } from "@/app/api/line/leave/cancel/route";
import { PUT as decideCancellation } from "@/app/api/line/leave/cancel/route";
import { POST as decideLeave } from "@/app/api/line/leave/decision/route";
import { GET as getProfile } from "@/app/api/line/leave/me/route";
import { PUT as confirmNotTaken } from "@/app/api/line/leave/not-taken/route";
import { POST as createRequest } from "@/app/api/line/leave/request/route";
import { GET as getDetail } from "@/app/api/line/leave/requests/[id]/route";
import { API_ROUTES } from "@/lib/ssot/routes";
import { LEAVE_JSON_MUTATION_MAX_BYTES } from "@/lib/server/leave-api";

const AUTH = {
    ok: true as const,
    user: {
        id: 7,
        role: "ADMIN",
        email: "admin@example.com",
        name: "ผู้อนุมัติ ทดสอบ",
    },
    employeeId: 31,
};

const EMPTY_METADATA = {
    currentPage: 1,
    totalPages: 0,
    totalItems: 0,
    itemsPerPage: 10,
};

function request(
    path: string,
    init?: ConstructorParameters<typeof NextRequest>[1],
): NextRequest {
    return new NextRequest(`http://localhost${path}`, init);
}

describe("LIFF Leave route adapters", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("NEXT_PUBLIC_FEATURE_LEAVE", "true");
        mocks.requireLiffWorkforceSession.mockResolvedValue(AUTH);
        mocks.getEmployeeLeaveProfile.mockResolvedValue({
            quotas: [],
            history: [],
            metadata: { ...EMPTY_METADATA, availableYears: [] },
        });
        mocks.getLeaveApprovalList.mockResolvedValue({
            pending: [],
            notTakenPending: [],
            cancellationPending: [],
            history: [],
            metadata: {
                pending: EMPTY_METADATA,
                notTakenPending: EMPTY_METADATA,
                cancellationPending: EMPTY_METADATA,
                history: { ...EMPTY_METADATA, availableYears: [] },
            },
        });
        mocks.processOutbox.mockResolvedValue(undefined);
    });

    it("derives the employee profile scope from the LIFF session", async () => {
        const response = await getProfile(request(
            "/api/line/leave/me?page=2&q=%E0%B8%9B%E0%B9%88%E0%B8%A7%E0%B8%A2&leaveType=SICK&status=APPROVED&year=2026&employeeId=999",
        ));

        expect(response.status).toBe(200);
        expect(mocks.getEmployeeLeaveProfile).toHaveBeenCalledWith({
            employeeId: 31,
            page: 2,
            limit: 10,
            filters: {
                query: "ป่วย",
                leaveType: "SICK",
                status: "APPROVED",
                year: 2026,
            },
            buildAttachmentUrl: API_ROUTES.line.leaveAttachmentById,
        });
    });

    it.each(["1x", "0", "-1", "1.5"])(
        "rejects invalid profile page %s",
        async (page) => {
            const response = await getProfile(request(`/api/line/leave/me?page=${page}`));

            expect(response.status).toBe(400);
            expect(mocks.getEmployeeLeaveProfile).not.toHaveBeenCalled();
        },
    );

    it("queries only the authenticated employee's effective approval workload", async () => {
        const response = await getApprovals(request(
            "/api/line/leave/approvals?pendingPage=1&notTakenPage=2&cancellationPage=3&managerId=999",
        ));

        expect(response.status).toBe(200);
        expect(mocks.getLeaveApprovalList).toHaveBeenCalledWith(expect.objectContaining({
            managerId: 31,
            pendingPage: 1,
            notTakenPage: 2,
            cancellationPage: 3,
            includeHistory: false,
        }));
    });

    it("uses a dedicated participant-authorized detail query for deep links", async () => {
        mocks.getAuthorizedLeaveDetail.mockResolvedValueOnce({
            id: "leave_1",
            employeeId: 20,
            leaveType: "SICK",
            startDate: new Date("2026-09-01T00:00:00.000Z"),
            endDate: new Date("2026-09-01T00:00:00.000Z"),
            period: "FULL_DAY",
            durationDays: 1,
            reason: "พักรักษาตัว",
            emergencyReason: null,
            specialReason: null,
            overQuotaDays: 0,
            status: "PENDING",
            approverId: 31,
            approvedAt: null,
            rejectReason: null,
            notTakenReason: null,
            notTakenRequestedAt: null,
            notTakenConfirmedAt: null,
            notTakenConfirmedById: null,
            cancellationReason: null,
            cancellationRequestedAt: null,
            cancellationConfirmedAt: null,
            cancellationConfirmedById: null,
            attachments: [],
            createdAt: new Date("2026-08-30T00:00:00.000Z"),
            updatedAt: new Date("2026-08-30T00:00:00.000Z"),
            attachmentUrl: "private/storage/path.webp",
            viewerRole: "APPROVER",
            availableActions: ["APPROVE", "REJECT"],
        });

        const response = await getDetail(
            request("/api/line/leave/requests/leave_1"),
            { params: Promise.resolve({ id: "leave_1" }) },
        );

        expect(response.status).toBe(200);
        expect(mocks.getAuthorizedLeaveDetail).toHaveBeenCalledWith(
            "leave_1",
            31,
            API_ROUTES.line.leaveAttachmentById,
        );
        const body = await response.json() as Record<string, unknown>;
        expect(body).not.toHaveProperty("employeeId");
        expect(body).not.toHaveProperty("approverId");
        expect(body).not.toHaveProperty("attachmentUrl");
        expect(body).not.toHaveProperty("exceptionApproverId");
    });

    it("returns private attachment bytes only after participant authorization", async () => {
        mocks.getAuthorizedLeaveAttachment.mockResolvedValueOnce({
            storageKey: "private/leave.webp",
            contentType: "image/webp",
        });
        mocks.readLeaveAttachment.mockResolvedValueOnce(Buffer.from("image"));

        const response = await getAttachment(
            request("/api/line/leave/attachments/attachment_1"),
            { params: Promise.resolve({ id: "attachment_1" }) },
        );

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toBe("image/webp");
        expect(response.headers.get("cache-control")).toBe("private, no-store");
        expect(mocks.getAuthorizedLeaveAttachment).toHaveBeenCalledWith(
            "attachment_1",
            31,
        );
    });

    it("does not let an unrelated ADMIN bypass attachment authorization", async () => {
        mocks.getAuthorizedLeaveAttachment.mockResolvedValueOnce(null);

        const response = await getAttachment(
            request("/api/line/leave/attachments/attachment_1"),
            { params: Promise.resolve({ id: "attachment_1" }) },
        );

        expect(response.status).toBe(404);
        expect(mocks.readLeaveAttachment).not.toHaveBeenCalled();
    });

    it("passes the LIFF employee identity into shared request creation", async () => {
        const expected = NextResponse.json({ success: true }, { status: 201 });
        mocks.handleLeaveRequestSubmission.mockResolvedValueOnce(expected);
        const nextRequest = request("/api/line/leave/request", {
            method: "POST",
            headers: {
                "Content-Type": "multipart/form-data; boundary=test",
                "Content-Length": "100",
            },
        });

        const response = await createRequest(nextRequest);

        expect(response.status).toBe(201);
        expect(mocks.handleLeaveRequestSubmission).toHaveBeenCalledWith(
            nextRequest,
            { userId: 7, employeeId: 31, userEmail: "admin@example.com" },
            API_ROUTES.line.leaveAttachmentById,
            expect.any(Function),
            expect.any(Function),
        );
    });

    it("keeps internal Leave fields out of LIFF mutation responses", async () => {
        mocks.cancelLeaveRequest.mockResolvedValueOnce({
            request: {
                id: "leave_1",
                status: "CANCELLED",
                employeeId: 999,
                approverId: 888,
                attachmentUrl: "private/storage/path.webp",
                employee: { user: { email: "employee@example.com" } },
                approver: { user: { email: "approver@example.com" } },
            },
        });

        const response = await cancelLeave(request("/api/line/leave/cancel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ leaveId: "leave_1" }),
        }));

        await expect(response.json()).resolves.toEqual({
            success: true,
            data: { id: "leave_1", status: "CANCELLED" },
        });
    });

    it.each([
        ["cancel", () => cancelLeave(request("/api/line/leave/cancel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: new ArrayBuffer(LEAVE_JSON_MUTATION_MAX_BYTES + 1),
        }))],
        ["decision", () => decideLeave(request("/api/line/leave/decision", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: new ArrayBuffer(LEAVE_JSON_MUTATION_MAX_BYTES + 1),
        }))],
    ] as const)(
        "rejects an actually oversized LIFF Leave %s body before its domain service",
        async (_label, invoke) => {
            const response = await invoke();

            expect(response.status).toBe(413);
            expect(mocks.cancelLeaveRequest).not.toHaveBeenCalled();
            expect(mocks.decideLeaveRequest).not.toHaveBeenCalled();
        },
    );

    it("never enables ADMIN recovery for LIFF approver mutations", async () => {
        mocks.confirmLeaveCancellation.mockResolvedValueOnce({ request: { id: "leave_1" } });
        mocks.handleLeaveNotTakenConfirmation.mockResolvedValueOnce(
            NextResponse.json({ success: true }),
        );
        mocks.decideLeaveRequest.mockResolvedValueOnce({ id: "leave_1" });

        const cancellationResponse = await decideCancellation(request(
            "/api/line/leave/cancel",
            {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ leaveId: "leave_1", action: "CONFIRM" }),
            },
        ));
        const notTakenRequest = request("/api/line/leave/not-taken", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ leaveId: "leave_1" }),
        });
        const notTakenResponse = await confirmNotTaken(notTakenRequest);
        const decisionResponse = await decideLeave(request("/api/line/leave/decision", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ leaveId: "leave_1", action: "APPROVE" }),
        }));

        expect(cancellationResponse.status).toBe(200);
        expect(notTakenResponse.status).toBe(200);
        expect(decisionResponse.status).toBe(200);
        expect(mocks.confirmLeaveCancellation).toHaveBeenCalledWith(
            expect.objectContaining({ employeeId: 31, allowAdminOverride: false }),
            "leave_1",
            undefined,
        );
        expect(mocks.handleLeaveNotTakenConfirmation).toHaveBeenCalledWith(
            notTakenRequest,
            AUTH,
            {
                allowAdminOverride: false,
                serializeResponse: expect.any(Function),
                scheduleOutbox: expect.any(Function),
            },
        );
        expect(mocks.decideLeaveRequest).toHaveBeenCalledWith(
            expect.objectContaining({ employeeId: 31 }),
            { leaveId: "leave_1", action: "APPROVE" },
        );
    });

    it("requires a LIFF session and applies the Leave feature guard", async () => {
        mocks.requireLiffWorkforceSession.mockResolvedValueOnce({
            ok: false,
            response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        });
        expect((await getProfile(request("/api/line/leave/me"))).status).toBe(401);

        vi.stubEnv("NEXT_PUBLIC_FEATURE_LEAVE", "false");
        expect((await getApprovals(request("/api/line/leave/approvals"))).status).toBe(404);
    });
});
