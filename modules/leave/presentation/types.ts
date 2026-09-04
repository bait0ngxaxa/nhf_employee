export interface LeaveAttachmentSummary {
    id: string;
    contentType: string;
    sizeBytes: number;
    width: number | null;
    height: number | null;
    viewUrl: string;
}

export type LeaveTypeValue = "SICK" | "PERSONAL" | "VACATION";
export type LeavePeriodValue = "FULL_DAY" | "MORNING" | "AFTERNOON";
export type LeaveStatusValue =
    | "PENDING"
    | "APPROVED"
    | "REJECTED"
    | "CANCELLED"
    | "NOT_TAKEN"
    | "CANCELLATION_REQUESTED"
    | "CANCELLED_AFTER_APPROVAL";

export type EmployeeLeaveAction =
    | "CANCEL"
    | "REQUEST_CANCELLATION"
    | "REQUEST_NOT_TAKEN";

export type ApproverLeaveAction =
    | "APPROVE"
    | "REJECT"
    | "CONFIRM_NOT_TAKEN"
    | "CONFIRM_CANCELLATION"
    | "REJECT_CANCELLATION";

export interface LeaveQuotaSummary {
    id: string;
    year: number;
    employeeId: number;
    leaveType: LeaveTypeValue;
    totalDays: number;
    carryBalanceDays: number;
    effectiveTotalDays: number;
    usedDays: number;
    remainingDays: number;
}

export interface LeaveApproverSummary {
    firstName: string;
    lastName: string;
    nickname: string | null;
}

export interface LeaveEmployeeSummary extends LeaveApproverSummary {
    position: string;
    departmentId: number;
    dept?: { name: string } | null;
}

export interface LeaveRequestSummary {
    id: string;
    employeeId: number;
    leaveType: LeaveTypeValue;
    startDate: string;
    endDate: string;
    period: LeavePeriodValue;
    durationDays: number;
    reason: string;
    emergencyReason: string | null;
    specialReason: string | null;
    overQuotaDays: number;
    status: LeaveStatusValue;
    approverId: number | null;
    approvedAt: string | null;
    rejectReason: string | null;
    notTakenReason: string | null;
    notTakenRequestedAt: string | null;
    notTakenConfirmedAt: string | null;
    notTakenConfirmedById: number | null;
    cancellationReason: string | null;
    cancellationRequestedAt: string | null;
    cancellationConfirmedAt: string | null;
    cancellationConfirmedById: number | null;
    attachments: LeaveAttachmentSummary[];
    createdAt: string;
    updatedAt: string;
    approver?: LeaveApproverSummary | null;
}

export interface LeaveApprovalItem {
    id: string;
    employeeId: number;
    leaveType: LeaveTypeValue;
    startDate: string;
    endDate: string;
    period: LeavePeriodValue;
    durationDays: number;
    reason: string;
    emergencyReason: string | null;
    specialReason: string | null;
    overQuotaDays: number;
    status: LeaveStatusValue;
    cancellationReason: string | null;
    cancellationRequestedAt: string | null;
    cancellationConfirmedAt: string | null;
    cancellationConfirmedById: number | null;
    notTakenReason: string | null;
    notTakenRequestedAt: string | null;
    notTakenConfirmedAt: string | null;
    createdAt: string;
    attachments: LeaveAttachmentSummary[];
    employee: LeaveEmployeeSummary;
}

export interface LeavePaginationMetadata {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
}

export interface LeaveHistoryMetadata extends LeavePaginationMetadata {
    availableYears: number[];
}

export type LiffLeaveQuotaSummary = Omit<
    LeaveQuotaSummary,
    "id" | "employeeId"
>;

type LiffLeaveRequestSummary = Omit<
    LeaveRequestSummary,
    | "employeeId"
    | "approverId"
    | "notTakenConfirmedById"
    | "cancellationConfirmedById"
>;

export interface LiffEmployeeLeaveRequest extends LiffLeaveRequestSummary {
    availableActions: EmployeeLeaveAction[];
}

export interface LiffLeaveProfileResponse {
    quotas: LiffLeaveQuotaSummary[];
    history: LiffEmployeeLeaveRequest[];
    metadata: LeaveHistoryMetadata;
}

export interface LiffLeaveApprovalItem extends Omit<
    LeaveApprovalItem,
    "employeeId" | "cancellationConfirmedById" | "employee"
> {
    employee: Omit<LeaveEmployeeSummary, "departmentId">;
    availableActions: ApproverLeaveAction[];
}

export interface LiffLeaveApprovalsResponse {
    pending: LiffLeaveApprovalItem[];
    notTakenPending: LiffLeaveApprovalItem[];
    cancellationPending: LiffLeaveApprovalItem[];
    metadata: {
        pending: LeavePaginationMetadata;
        notTakenPending: LeavePaginationMetadata;
        cancellationPending: LeavePaginationMetadata;
    };
    hasActionableWork: boolean;
}

export interface LiffLeaveRequestDetail extends LiffLeaveRequestSummary {
    employee?: Omit<LeaveEmployeeSummary, "departmentId">;
    viewerRole: "REQUESTER" | "APPROVER";
    availableActions: Array<EmployeeLeaveAction | ApproverLeaveAction>;
}
