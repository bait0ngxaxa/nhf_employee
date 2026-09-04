import type {
    ApproverLeaveAction,
    EmployeeLeaveAction,
    LeaveApprovalItem,
    LeaveApproverSummary,
    LeaveAttachmentSummary,
    LeaveEmployeeSummary,
    LeavePeriodValue,
    LeaveRequestSummary,
    LeaveStatusValue,
    LeaveTypeValue,
    LiffEmployeeLeaveRequest,
    LiffLeaveApprovalItem,
    LiffLeaveQuotaSummary,
    LiffLeaveRequestDetail,
} from "@/modules/leave/presentation/types";

export interface LiffLeaveMutationResponse {
    id: string;
    status: LeaveStatusValue;
}

export function toLiffLeaveMutationResponse(
    request: Pick<LeaveRequestSummary, "id" | "status">,
): LiffLeaveMutationResponse {
    return {
        id: request.id,
        status: request.status,
    };
}

type LiffLeaveRequestSummary = Omit<
    LeaveRequestSummary,
    | "employeeId"
    | "approverId"
    | "notTakenConfirmedById"
    | "cancellationConfirmedById"
>;

type DateValue = Date | string;

interface LeaveRequestSource {
    id: string;
    leaveType: LeaveTypeValue;
    startDate: DateValue;
    endDate: DateValue;
    period: LeavePeriodValue;
    durationDays: number;
    reason: string;
    emergencyReason: string | null;
    specialReason: string | null;
    overQuotaDays: number;
    status: LeaveStatusValue;
    approvedAt: DateValue | null;
    rejectReason: string | null;
    notTakenReason: string | null;
    notTakenRequestedAt: DateValue | null;
    notTakenConfirmedAt: DateValue | null;
    cancellationReason: string | null;
    cancellationRequestedAt: DateValue | null;
    cancellationConfirmedAt: DateValue | null;
    attachments: LeaveAttachmentSummary[];
    createdAt: DateValue;
    updatedAt: DateValue;
    approver?: LeaveApproverSummary | null;
}

interface LeaveQuotaSource {
    year: number;
    leaveType: LeaveTypeValue;
    totalDays: number;
    carryBalanceDays: number;
    effectiveTotalDays: number;
    usedDays: number;
    remainingDays: number;
}

interface LeaveApprovalSource {
    id: string;
    leaveType: LeaveTypeValue;
    startDate: DateValue;
    endDate: DateValue;
    period: LeavePeriodValue;
    durationDays: number;
    reason: string;
    emergencyReason: string | null;
    specialReason: string | null;
    overQuotaDays: number;
    status: LeaveStatusValue;
    cancellationReason: string | null;
    cancellationRequestedAt: DateValue | null;
    cancellationConfirmedAt: DateValue | null;
    notTakenReason: string | null;
    notTakenRequestedAt: DateValue | null;
    notTakenConfirmedAt: DateValue | null;
    createdAt: DateValue;
    attachments: LeaveAttachmentSummary[];
    employee: LeaveEmployeeSummary;
}

function serializeDate(value: DateValue): string {
    return value instanceof Date ? value.toISOString() : value;
}

function serializeNullableDate(value: DateValue | null): string | null {
    return value === null ? null : serializeDate(value);
}

export function toLiffLeaveQuota(
    quota: LeaveQuotaSource,
): LiffLeaveQuotaSummary {
    return {
        year: quota.year,
        leaveType: quota.leaveType,
        totalDays: quota.totalDays,
        carryBalanceDays: quota.carryBalanceDays,
        effectiveTotalDays: quota.effectiveTotalDays,
        usedDays: quota.usedDays,
        remainingDays: quota.remainingDays,
    };
}

export function toLiffEmployeeLeaveRequest(
    request: LeaveRequestSource,
    availableActions: EmployeeLeaveAction[],
): LiffEmployeeLeaveRequest {
    return {
        ...toLiffLeaveRequestSummary(request),
        availableActions,
    };
}

export function toLiffLeaveApprovalItem(
    request: LeaveApprovalSource,
    availableActions: ApproverLeaveAction[],
): LiffLeaveApprovalItem {
    const employee: Omit<LeaveEmployeeSummary, "departmentId"> = {
        firstName: request.employee.firstName,
        lastName: request.employee.lastName,
        nickname: request.employee.nickname,
        position: request.employee.position,
        dept: request.employee.dept
            ? { name: request.employee.dept.name }
            : null,
    };
    const item: Omit<
        LeaveApprovalItem,
        "employeeId" | "cancellationConfirmedById" | "employee"
    > & { employee: Omit<LeaveEmployeeSummary, "departmentId"> } = {
        id: request.id,
        leaveType: request.leaveType,
        startDate: serializeDate(request.startDate),
        endDate: serializeDate(request.endDate),
        period: request.period,
        durationDays: request.durationDays,
        reason: request.reason,
        emergencyReason: request.emergencyReason,
        specialReason: request.specialReason,
        overQuotaDays: request.overQuotaDays,
        status: request.status,
        cancellationReason: request.cancellationReason,
        cancellationRequestedAt: serializeNullableDate(request.cancellationRequestedAt),
        cancellationConfirmedAt: serializeNullableDate(request.cancellationConfirmedAt),
        notTakenReason: request.notTakenReason,
        notTakenRequestedAt: serializeNullableDate(request.notTakenRequestedAt),
        notTakenConfirmedAt: serializeNullableDate(request.notTakenConfirmedAt),
        createdAt: serializeDate(request.createdAt),
        attachments: request.attachments.map(toLiffLeaveAttachment),
        employee,
    };
    return { ...item, availableActions };
}

export function toLiffLeaveRequestDetail(
    request: LeaveRequestSource & {
        employee?: LeaveEmployeeSummary;
        viewerRole: "REQUESTER" | "APPROVER";
        availableActions: Array<EmployeeLeaveAction | ApproverLeaveAction>;
    },
): LiffLeaveRequestDetail {
    return {
        ...toLiffLeaveRequestSummary(request),
        ...(request.employee
            ? {
                employee: {
                    firstName: request.employee.firstName,
                    lastName: request.employee.lastName,
                    nickname: request.employee.nickname,
                    position: request.employee.position,
                    dept: request.employee.dept
                        ? { name: request.employee.dept.name }
                        : null,
                },
            }
            : {}),
        viewerRole: request.viewerRole,
        availableActions: request.availableActions,
    };
}

function toLiffLeaveRequestSummary(
    request: LeaveRequestSource,
): LiffLeaveRequestSummary {
    return {
        id: request.id,
        leaveType: request.leaveType,
        startDate: serializeDate(request.startDate),
        endDate: serializeDate(request.endDate),
        period: request.period,
        durationDays: request.durationDays,
        reason: request.reason,
        emergencyReason: request.emergencyReason,
        specialReason: request.specialReason,
        overQuotaDays: request.overQuotaDays,
        status: request.status,
        approvedAt: serializeNullableDate(request.approvedAt),
        rejectReason: request.rejectReason,
        notTakenReason: request.notTakenReason,
        notTakenRequestedAt: serializeNullableDate(request.notTakenRequestedAt),
        notTakenConfirmedAt: serializeNullableDate(request.notTakenConfirmedAt),
        cancellationReason: request.cancellationReason,
        cancellationRequestedAt: serializeNullableDate(request.cancellationRequestedAt),
        cancellationConfirmedAt: serializeNullableDate(request.cancellationConfirmedAt),
        attachments: request.attachments.map(toLiffLeaveAttachment),
        createdAt: serializeDate(request.createdAt),
        updatedAt: serializeDate(request.updatedAt),
        approver: request.approver
            ? {
                firstName: request.approver.firstName,
                lastName: request.approver.lastName,
                nickname: request.approver.nickname,
            }
            : null,
    };
}

function toLiffLeaveAttachment(
    attachment: LeaveAttachmentSummary,
): LeaveAttachmentSummary {
    return {
        id: attachment.id,
        contentType: attachment.contentType,
        sizeBytes: attachment.sizeBytes,
        width: attachment.width,
        height: attachment.height,
        viewUrl: attachment.viewUrl,
    };
}
