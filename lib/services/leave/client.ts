import { apiGet, apiPost, apiPut, type ApiResponse } from "@/lib/api-client";
import { triggerDownload } from "@/lib/helpers/download";
import { API_ROUTES } from "@/lib/ssot/routes";
import type { LeaveRequestValues } from "@/lib/validations/leave";

export interface LeaveExportYearsResponse {
    years: number[];
}

export interface LeaveExportMetaResponse {
    count: number;
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
    dept: { name: string } | null;
}

interface ApproverAssignmentsPayload {
    assignments: Array<{ employeeId: number; managerId: number | null }>;
}

interface ApproverAssignmentsResponse {
    message: string;
}

export type LeaveApprovalAction = "APPROVE" | "REJECT";

interface LeaveApprovalPayload {
    leaveId: string;
    action: LeaveApprovalAction;
    reason?: string;
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

export const fetchLeaveExportMeta = async (year: number): Promise<LeaveExportMetaResponse> => {
    const response = await apiGet<LeaveExportMetaResponse>(
        `${API_ROUTES.leave.export}?year=${year}&metaOnly=1`,
    );
    return ensureSuccess(response);
};

export const downloadLeaveExportFile = (year: number): void => {
    triggerDownload(`${API_ROUTES.leave.export}?year=${year}&format=csv`);
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

