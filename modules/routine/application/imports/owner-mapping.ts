import { ROUTINE_IMPORT_REVIEW_REASONS } from "./constants";
import {
    getEmployeeDisplayName,
    getEmployeeFullName,
} from "@/lib/helpers/employee-helpers";
import type {
    RoutineImportOwnerMapping,
    RoutineImportReferenceData,
} from "./types";

export function normalizeOwnerKey(value: string): string {
    return value.replace(/[\u00a0\r\n\t]+/gu, " ").replace(/\s+/gu, " ").trim();
}

export function splitOwnerNames(value: string | null): string[] {
    if (!value) return [];
    return value
        .replace(/\s+และ\s+/gu, ",")
        .split(/[,/]/u)
        .map(normalizeOwnerKey)
        .filter((name) => name.length > 0 && !name.startsWith("*"));
}

export interface RoutineOwnerResolution {
    mappedEmployeeIds: number[];
    mappedEmployeeNames: string[];
    reviewReasons: string[];
}

function addExactMapping(
    mapping: Map<string, number | null>,
    value: string | null,
    employeeId: number,
): void {
    const key = value ? normalizeOwnerKey(value) : "";
    if (!key) return;
    const current = mapping.get(key);
    if (current === undefined) {
        mapping.set(key, employeeId);
        return;
    }
    if (current !== employeeId) mapping.set(key, null);
}

export function buildExactRoutineOwnerMapping(
    referenceData: RoutineImportReferenceData,
): RoutineImportOwnerMapping {
    const candidates = new Map<string, number | null>();
    for (const employee of referenceData.employees) {
        if (employee.status !== "ACTIVE" || employee.deletedAt !== null) continue;
        addExactMapping(
            candidates,
            getEmployeeFullName(employee.firstName, employee.lastName),
            employee.id,
        );
        addExactMapping(candidates, employee.nickname, employee.id);
    }

    return Object.fromEntries(
        [...candidates.entries()]
            .filter((entry): entry is [string, number] => entry[1] !== null)
            .map(([key, employeeId]) => [key, employeeId]),
    );
}

export function resolveRoutineOwners(
    ownerNames: readonly string[],
    mapping: RoutineImportOwnerMapping,
    referenceData: RoutineImportReferenceData,
): RoutineOwnerResolution {
    const mappedEmployeeIds: number[] = [];
    const mappedEmployeeNames: string[] = [];
    const reviewReasons: string[] = [];
    const employeesById = new Map(
        referenceData.employees.map((employee) => [employee.id, employee]),
    );
    const mappedIds = new Set<number>();

    if (ownerNames.length === 0) {
        return {
            mappedEmployeeIds,
            mappedEmployeeNames,
            reviewReasons: [ROUTINE_IMPORT_REVIEW_REASONS.MISSING_OWNER],
        };
    }

    for (const ownerName of ownerNames) {
        const employeeId = mapping[normalizeOwnerKey(ownerName)];
        if (!employeeId) {
            reviewReasons.push(
                `${ROUTINE_IMPORT_REVIEW_REASONS.OWNER_MAPPING_EMPLOYEE_NOT_FOUND}:${ownerName}`,
            );
            continue;
        }

        const employee = employeesById.get(employeeId);
        if (!employee) {
            reviewReasons.push(
                `${ROUTINE_IMPORT_REVIEW_REASONS.OWNER_MAPPING_EMPLOYEE_NOT_FOUND}:${ownerName}`,
            );
            continue;
        }
        if (employee.status !== "ACTIVE" || employee.deletedAt !== null) {
            reviewReasons.push(
                `${ROUTINE_IMPORT_REVIEW_REASONS.OWNER_MAPPING_EMPLOYEE_INACTIVE}:${ownerName}`,
            );
            continue;
        }
        if (mappedIds.has(employee.id)) {
            reviewReasons.push(
                `${ROUTINE_IMPORT_REVIEW_REASONS.DUPLICATE_OWNER}:${ownerName}`,
            );
            continue;
        }

        mappedIds.add(employee.id);
        mappedEmployeeIds.push(employee.id);
        mappedEmployeeNames.push(getEmployeeDisplayName({
            ...employee,
            nickname: employee.nickname === "-" ? null : employee.nickname,
        }));
    }

    return {
        mappedEmployeeIds,
        mappedEmployeeNames,
        reviewReasons: [...new Set(reviewReasons)],
    };
}

export function hasUnresolvedOwnerReview(reviewReasons: readonly string[]): boolean {
    return reviewReasons.some((reason) =>
        reason.startsWith(ROUTINE_IMPORT_REVIEW_REASONS.OWNER_MAPPING_EMPLOYEE_NOT_FOUND)
        || reason.startsWith(ROUTINE_IMPORT_REVIEW_REASONS.OWNER_MAPPING_EMPLOYEE_INACTIVE)
        || reason === ROUTINE_IMPORT_REVIEW_REASONS.MISSING_OWNER,
    );
}
