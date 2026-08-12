import type { AuditAction } from "@prisma/client";

export interface AuditDetails extends Record<string, unknown> {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}

export interface StockAttributeAuditSnapshot extends Record<string, unknown> {
    name: string;
    value: string;
}

export interface StockItemAuditSnapshot extends Record<string, unknown> {
    name: string;
    description: string | null;
    sku: string;
    unit: string;
    quantity: number;
    minStock: number;
    imageUrl: string | null;
    categoryId: number;
    categoryName?: string;
    isActive: boolean;
}

export interface StockVariantAuditSnapshot extends Record<string, unknown> {
    sku: string;
    unit: string;
    quantity: number;
    minStock: number;
    imageUrl: string | null;
    isActive: boolean;
    attributes: StockAttributeAuditSnapshot[];
}

export interface StockRequestLineAuditSnapshot extends Record<string, unknown> {
    itemId: number;
    itemName: string;
    sku: string;
    variantId: number;
    variantLabel?: string;
    quantity: number;
    unit: string;
    variantQuantityBefore?: number;
    variantQuantityAfter?: number;
}

export interface StockItemMutationAuditDetails extends AuditDetails {
    before?: StockItemAuditSnapshot | StockVariantAuditSnapshot;
    after?: StockItemAuditSnapshot | StockVariantAuditSnapshot;
    metadata?: Record<string, unknown> & {
        itemId: number;
        itemName?: string;
        itemSku?: string;
        variantId?: number;
        variantLabel?: string;
    };
}

export interface StockAdjustAuditDetails extends AuditDetails {
    before: Record<string, unknown> & {
        quantity: number;
        minStock: number;
        variantQuantity: number;
        variantMinStock: number;
    };
    after: Record<string, unknown> & {
        name: string;
        sku: string;
        quantity: number;
        minStock: number;
        variantQuantity: number;
        variantMinStock: number;
    };
    metadata: Record<string, unknown> & {
        itemId: number;
        itemName: string;
        itemSku: string;
        variantId: number;
        variantLabel: string;
        unit: string;
        adjustmentType: string;
        adjustmentQuantity: number;
        transactionIds: number[];
    };
}

interface StockRequestAuditMetadata extends Record<string, unknown> {
    stockRequestId: number;
    projectCode: string;
}

export interface StockRequestCreateAuditDetails extends AuditDetails {
    after: Record<string, unknown> & {
        status: string;
        itemCount: number;
        projectCode: string;
    };
    metadata: StockRequestAuditMetadata & {
        variantIds: number[];
        lines: StockRequestLineAuditSnapshot[];
        idempotencyKeyHash: string;
    };
}

export interface StockRequestIssueAuditDetails extends AuditDetails {
    before: Record<string, unknown> & { status: string };
    after: Record<string, unknown> & { status: string };
    metadata: StockRequestAuditMetadata & {
        variantIds: number[];
        transactionIds: number[];
        lines: StockRequestLineAuditSnapshot[];
    };
}

export interface StockRequestCancelAuditDetails extends AuditDetails {
    before: Record<string, unknown> & { status: string };
    after: Record<string, unknown> & { status: string };
    metadata: StockRequestAuditMetadata & { reason: string | null };
}

export interface LeaveAuditContext extends Record<string, unknown> {
    leaveRequestId: string;
    employeeId?: number;
    employeeName?: string;
    leaveType: "SICK" | "PERSONAL" | "VACATION";
    startDate: string;
    endDate: string;
    period: "FULL_DAY" | "MORNING" | "AFTERNOON";
    durationDays: number;
    attachmentCount?: number;
    reason?: string | null;
}

export interface LeaveCreateAuditDetails extends AuditDetails {
    after: Record<string, unknown> & { status: string };
    metadata: LeaveAuditContext;
}

export interface LeaveMutationAuditDetails extends AuditDetails {
    before: Record<string, unknown> & { status: string };
    after: Record<string, unknown> & {
        status: string;
        reason?: string | null;
    };
    metadata: LeaveAuditContext & {
        decision?: string;
        adminOverride?: boolean;
        overrideReason?: string;
        originalApproverId?: number | null;
        exceptionApproverId?: number | null;
        exceptionApproverSource?: string;
    };
}

export interface EmployeeApproverAuditDetails extends AuditDetails {
    before: {
        managerId: number | null;
        managerName: string | null;
    };
    after: {
        managerId: number | null;
        managerName: string | null;
    };
    metadata: {
        employeeId: number;
        employeeName: string;
        previousApproverId: number | null;
        previousApproverName: string | null;
        newApproverId: number | null;
        newApproverName: string | null;
    };
}

export interface AuditDetailsByAction {
    STOCK_ITEM_CREATE: StockItemMutationAuditDetails;
    STOCK_ITEM_UPDATE: StockItemMutationAuditDetails;
    STOCK_ITEM_DELETE: StockItemMutationAuditDetails;
    STOCK_ADJUST: StockAdjustAuditDetails;
    STOCK_REQUEST_CREATE: StockRequestCreateAuditDetails;
    STOCK_REQUEST_ISSUE: StockRequestIssueAuditDetails;
    STOCK_REQUEST_CANCEL: StockRequestCancelAuditDetails;
    LEAVE_REQUEST_CREATE: LeaveCreateAuditDetails;
    LEAVE_REQUEST_APPROVE: LeaveMutationAuditDetails;
    LEAVE_REQUEST_REJECT: LeaveMutationAuditDetails;
    LEAVE_REQUEST_CANCEL: LeaveMutationAuditDetails;
    LEAVE_REQUEST_CANCELLATION_REQUEST: LeaveMutationAuditDetails;
    LEAVE_REQUEST_CANCELLATION_CONFIRM: LeaveMutationAuditDetails;
    LEAVE_REQUEST_NOT_TAKEN_REQUEST: LeaveMutationAuditDetails;
    LEAVE_REQUEST_NOT_TAKEN_CONFIRM: LeaveMutationAuditDetails;
    EMPLOYEE_UPDATE: AuditDetails | EmployeeApproverAuditDetails;
    ROUTINE_TASK_CREATE: AuditDetails;
    ROUTINE_TASK_UPDATE: AuditDetails;
    ROUTINE_TASK_DEACTIVATE: AuditDetails;
    ROUTINE_TASK_DELETE: AuditDetails;
    ROUTINE_OCCURRENCE_REASSIGN: AuditDetails;
    ROUTINE_OCCURRENCE_DUE_DATE_CHANGE: AuditDetails;
    ROUTINE_IMPORT_UPLOAD: AuditDetails;
    ROUTINE_IMPORT_ROW_UPDATE: AuditDetails;
    ROUTINE_IMPORT_APPLY: AuditDetails;
    ROUTINE_IMPORT_CANCEL: AuditDetails;
}

export type ContractedAuditAction = keyof AuditDetailsByAction & AuditAction;

export type AuditDetailsFor<Action extends ContractedAuditAction> =
    AuditDetailsByAction[Action];

export function defineAuditDetails<Action extends ContractedAuditAction>(
    _action: Action,
    details: AuditDetailsFor<Action>,
): AuditDetailsFor<Action> {
    return details;
}
