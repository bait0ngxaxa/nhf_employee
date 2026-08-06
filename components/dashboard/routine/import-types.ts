import type { RoutineImportRow } from "@/lib/services/routine-import/types";
import type { RoutineImportRowUpdateInput } from "@/lib/validations/routine-import";
import type { RoutineImportReferenceData } from "@/lib/validations/routine-import-reference";

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
    selectedValidRows: number;
    unresolvedOwnerRows: number;
    expiresAt: string | null;
    appliedAt: string | null;
    errorMessage: string | null;
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

export type RoutineImportReference = RoutineImportReferenceData;

export type RoutineImportRowEdit = RoutineImportRowUpdateInput;
