import type { RoutineImportRow } from "@/lib/services/routine-import/types";
import type { RoutineImportRowUpdateInput } from "@/lib/validations/routine-import";

export type RoutineImportBatchStatus =
    | "PREVIEW"
    | "READY"
    | "APPLYING"
    | "COMPLETED"
    | "FAILED"
    | "CANCELLED"
    | "EXPIRED";

export type RoutineImportRowStatus =
    | "VALID"
    | "REQUIRES_REVIEW"
    | "EXCLUDED"
    | "ALREADY_IMPORTED"
    | "CONFLICT"
    | "APPLIED"
    | "FAILED";

export interface RoutineImportBatchView {
    id: number;
    originalFileName: string;
    fileHashPrefix: string;
    targetSheet: string;
    ignoredSheetNames: string[];
    asOfDate: string;
    status: RoutineImportBatchStatus;
    uploadedBy: { id: number; name: string };
    totalRows: number;
    validRows: number;
    reviewRows: number;
    excludedRows: number;
    alreadyImportedRows: number;
    appliedRows: number;
    conflictRows: number;
    failedRows: number;
    selectedRows: number;
    unresolvedOwnerRows: number;
    expiresAt: string | null;
    appliedAt: string | null;
    version: number;
    createdAt: string;
    updatedAt: string;
}

export interface RoutineImportRowView {
    id: number;
    sourceKey: string;
    sourceSheet: string;
    sourceRow: number;
    sourceFingerprint: string;
    status: RoutineImportRowStatus;
    selected: boolean;
    proposedActivation: "ACTIVE";
    reviewReasons: string[];
    appliedTaskId: number | null;
    version: number;
    data: RoutineImportRow;
}

export interface RoutineImportRowsPage {
    rows: RoutineImportRowView[];
    pagination: { page: number; limit: number; total: number; pages: number };
}

export interface RoutineImportReference {
    units: Array<{ id: number; code: string; name: string }>;
    categories: Array<{ id: number; name: string; sortOrder: number }>;
    employees: Array<{
        id: number;
        firstName: string;
        lastName: string;
        nickname: string | null;
        departmentId?: number;
        status?: string;
        deletedAt?: string | null;
    }>;
}

export type RoutineImportRowEdit = RoutineImportRowUpdateInput;
