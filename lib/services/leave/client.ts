import { apiGet, apiPost, apiPut, type ApiResponse } from "@/lib/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";
import { mapLeaveRowToCSV, type LeaveRequestRow } from "@/lib/helpers/csv-helpers";
import type { LeaveRequestValues } from "@/lib/validations/leave";

export interface LeaveExportYearsResponse {
    years: number[];
}

export interface ApproverEmployeeItem {
    id: number;
    firstName: string;
    lastName: string;
    nickname: string | null;
    email: string;
    position: string;
    managerId: number | null;
    dept: { name: string } | null;
}

interface ApproverAssignmentsPayload {
    assignments: Array<{ employeeId: number; managerId: number | null }>;
}

interface ApproverAssignmentsResponse {
    message: string;
}

export interface LeaveExportResponse {
    data: LeaveRequestRow[];
}

export type LeaveExportCsvRow = Record<string, string | number>;

export type LeaveApprovalAction = "APPROVE" | "REJECT";

interface LeaveApprovalPayload {
    leaveId: string;
    action: LeaveApprovalAction;
    reason?: string;
}

interface AuditExportPayload {
    entityType: "LeaveRequest";
    recordCount: number;
    filters: { year: number };
}

const DEFAULT_FETCH_ERROR = "ไม่สามารถดึงข้อมูลได้";

const ensureSuccess = <T>(response: ApiResponse<T>): T => {
    if (!response.success) {
        throw new Error(response.error || DEFAULT_FETCH_ERROR);
    }
    return response.data;
};

export const fetchLeaveExportYears = async (): Promise<LeaveExportYearsResponse> => {
    const response = await apiGet<LeaveExportYearsResponse>(`${API_ROUTES.leave.export}?yearsOnly=1`);
    return ensureSuccess(response);
};

export const fetchApproverEmployees = async (): Promise<ApproverEmployeeItem[]> => {
    const response = await apiGet<{ employees: ApproverEmployeeItem[] }>(API_ROUTES.leave.approvers);
    const data = ensureSuccess(response);
    return data.employees;
};

export const fetchLeaveExportRows = async (year: number): Promise<LeaveExportCsvRow[]> => {
    const response = await apiGet<LeaveExportResponse>(`${API_ROUTES.leave.export}?year=${year}`);
    const data = ensureSuccess(response);
    return data.data.map(mapLeaveRowToCSV);
};

export const saveApproverAssignments = async (
    payload: ApproverAssignmentsPayload,
): Promise<ApproverAssignmentsResponse> => {
    const response = await apiPut<ApproverAssignmentsResponse>(API_ROUTES.leave.approvers, payload);
    return ensureSuccess(response);
};

export const submitLeaveRequest = async (payload: LeaveRequestValues): Promise<void> => {
    const response = await apiPost<unknown>(API_ROUTES.leave.request, payload);
    ensureSuccess(response);
};

export const submitLeaveApprovalAction = async (payload: LeaveApprovalPayload): Promise<void> => {
    const response = await apiPost(API_ROUTES.leave.intranetAction, payload);
    ensureSuccess(response);
};

export const logLeaveExportAudit = async (year: number, recordCount: number): Promise<void> => {
    const payload: AuditExportPayload = {
        entityType: "LeaveRequest",
        recordCount,
        filters: { year },
    };
    await apiPost(API_ROUTES.auditLogs.export, payload);
};
