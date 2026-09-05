import { apiGet, apiPost, apiPut, type ApiResponse } from "@/lib/client/api-client";
import { fetchWithRefresh } from "@/lib/auth/client";
import { createIdempotencyKey } from "@/lib/client/idempotency-key";
import { triggerDownload } from "@/lib/helpers/download";
import { API_ROUTES } from "@/lib/ssot/routes";
import type { LeaveCancellationDecisionValues, LeaveRequestValues } from "../../schemas/leave";
import { DEFAULT_LEAVE_REPORT_SCOPE, type LeaveReportScope } from "../../schemas/report";

export interface LeaveExportYearsResponse {
    years: number[];
}

export interface LeaveExportMetaResponse {
    year: number;
    scope: LeaveReportScope;
    employeeCount: number;
    requestCount: number;
    maxRows: number;
}

export interface ApproverEmployeeItem {
    id: number;
    firstName: string;
    lastName: string;
    nickname: string | null;
    email: string;
    position: string;
    managerId: number | null;
    canApproveLeave: boolean;
    dept: { name: string } | null;
}

interface ApproverAssignmentsPayload {
    assignments: Array<{
        employeeId: number;
        managerId: number | null;
    }>;
}

interface ApproverAssignmentsResponse {
    message: string;
}

export type LeaveDecisionAction = "APPROVE" | "REJECT";

interface LeaveDecisionPayload {
    leaveId: string;
    action: LeaveDecisionAction;
    reason?: string;
}

interface LeaveNotTakenPayload {
    leaveId: string;
    note: string;
}

interface LeaveNotTakenConfirmPayload {
    leaveId: string;
    reason?: string;
}

const DEFAULT_FETCH_ERROR = "ไม่สามารถดึงข้อมูลได้";

const ensureSuccess = <T>(response: ApiResponse<T>): T => {
    if (!response.success) {
        throw new Error(response.error || response.errorThai || DEFAULT_FETCH_ERROR);
    }
    return response.data;
};

export const fetchLeaveExportYears = async (
    scope: LeaveReportScope = DEFAULT_LEAVE_REPORT_SCOPE,
): Promise<LeaveExportYearsResponse> => {
    const response = await apiGet<LeaveExportYearsResponse>(
        `${API_ROUTES.leave.export}?yearsOnly=1&scope=${scope}`,
    );
    return ensureSuccess(response);
};

export const fetchApproverEmployees = async (): Promise<ApproverEmployeeItem[]> => {
    const response = await apiGet<{ employees: ApproverEmployeeItem[] }>(API_ROUTES.leave.approvers);
    const data = ensureSuccess(response);
    return data.employees;
};

export const fetchLeaveExportMeta = async (
    year: number,
    scope: LeaveReportScope = DEFAULT_LEAVE_REPORT_SCOPE,
): Promise<LeaveExportMetaResponse> => {
    const response = await apiGet<LeaveExportMetaResponse>(
        `${API_ROUTES.leave.export}?year=${year}&metaOnly=1&scope=${scope}`,
    );
    return ensureSuccess(response);
};

export const downloadLeaveExportFile = (
    year: number,
    scope: LeaveReportScope = DEFAULT_LEAVE_REPORT_SCOPE,
): void => {
    triggerDownload(`${API_ROUTES.leave.export}?year=${year}&format=xlsx&scope=${scope}`);
};

export const saveApproverAssignments = async (
    payload: ApproverAssignmentsPayload,
): Promise<ApproverAssignmentsResponse> => {
    const response = await apiPut<ApproverAssignmentsResponse>(API_ROUTES.leave.approvers, payload);
    return ensureSuccess(response);
};

export const submitLeaveRequest = async (
    payload: LeaveRequestValues,
    attachments: readonly File[],
    idempotencyKey: string = createIdempotencyKey(),
): Promise<void> => {
    const formData = new FormData();
    formData.set("payload", JSON.stringify(payload));
    for (const attachment of attachments) {
        formData.append("attachments", attachment);
    }

    const response = await apiPost<unknown>(
        API_ROUTES.leave.request,
        formData,
        { headers: { "Idempotency-Key": idempotencyKey } },
    );
    ensureSuccess(response);
};

export const fetchLeaveAttachmentImage = async (
    attachmentId: string,
    signal?: AbortSignal,
): Promise<Blob> => {
    const response = await fetchWithRefresh(
        API_ROUTES.leave.attachmentById(attachmentId),
        {
            cache: "no-store",
            credentials: "include",
            ...(signal ? { signal } : {}),
        },
    );
    if (!response.ok) {
        throw new Error("Private attachment request failed");
    }

    const blob = await response.blob();
    if (blob.type !== "image/webp") {
        throw new Error("Unexpected private attachment content type");
    }
    return blob;
};

export const submitLeaveDecision = async (payload: LeaveDecisionPayload): Promise<void> => {
    const response = await apiPost(API_ROUTES.leave.decision, payload);
    ensureSuccess(response);
};

export const submitLeaveNotTakenRequest = async (
    payload: LeaveNotTakenPayload,
): Promise<void> => {
    const response = await apiPost(API_ROUTES.leave.notTaken, payload);
    ensureSuccess(response);
};

export const confirmLeaveNotTaken = async (
    payload: LeaveNotTakenConfirmPayload,
): Promise<void> => {
    const response = await apiPut(API_ROUTES.leave.notTaken, payload);
    ensureSuccess(response);
};

export interface LeaveCancellationPayload {
    leaveId: string;
    reason?: string;
}

export type LeaveCancellationDecisionAction = LeaveCancellationDecisionValues["action"];

export interface LeaveCancellationDecisionPayload {
    leaveId: string;
    action: LeaveCancellationDecisionAction;
    reason?: string;
}

export const requestLeaveCancellation = async (
    payload: LeaveCancellationPayload,
): Promise<void> => {
    const response = await apiPost(API_ROUTES.leave.cancel, payload);
    ensureSuccess(response);
};

export const confirmLeaveCancellation = async (
    payload: Pick<LeaveCancellationDecisionPayload, "leaveId" | "reason">,
): Promise<void> => {
    const response = await apiPut(API_ROUTES.leave.cancel, {
        ...payload,
        action: "CONFIRM",
    });
    ensureSuccess(response);
};

export const rejectLeaveCancellation = async (
    payload: Pick<LeaveCancellationDecisionPayload, "leaveId" | "reason">,
): Promise<void> => {
    const response = await apiPut(API_ROUTES.leave.cancel, {
        ...payload,
        action: "REJECT",
    });
    ensureSuccess(response);
};

