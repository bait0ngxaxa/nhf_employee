import { describe, expect, it } from "vitest";

import {
    resolveRoutineOwners,
    splitOwnerNames,
} from "@/lib/services/routine-import";
import type { RoutineImportReferenceData } from "@/lib/services/routine-import";

const referenceData: RoutineImportReferenceData = {
    units: [],
    categories: [],
    employees: [
        {
            id: 10,
            firstName: "กัลยาณี",
            lastName: "ศรีตะพันธ์",
            nickname: "อ้อย",
            departmentId: 1,
            status: "ACTIVE",
            deletedAt: null,
        },
        {
            id: 11,
            firstName: "อดีต",
            lastName: "พนักงาน",
            nickname: null,
            departmentId: 1,
            status: "INACTIVE",
            deletedAt: null,
        },
    ],
};

describe("routine import owner mapping", () => {
    it("splits multiple owners without fuzzy matching", () => {
        expect(splitOwnerNames("กัลยาณี / พี่นวล, ธนันษ์ชนกม์")).toEqual([
            "กัลยาณี",
            "พี่นวล",
            "ธนันษ์ชนกม์",
        ]);
        const result = resolveRoutineOwners(
            ["กัลยาณี", "พี่นวล"],
            { กัลยาณี: 10 },
            referenceData,
        );
        expect(result.mappedEmployeeIds).toEqual([10]);
        expect(result.reviewReasons).toContain(
            "OWNER_MAPPING_EMPLOYEE_NOT_FOUND:พี่นวล",
        );
    });

    it("rejects inactive mapped employees and duplicate mappings", () => {
        const inactive = resolveRoutineOwners(
            ["อดีต"],
            { อดีต: 11 },
            referenceData,
        );
        expect(inactive.reviewReasons).toContain(
            "OWNER_MAPPING_EMPLOYEE_INACTIVE:อดีต",
        );

        const duplicate = resolveRoutineOwners(
            ["กัลยาณี", "สำเนา"],
            { กัลยาณี: 10, สำเนา: 10 },
            referenceData,
        );
        expect(duplicate.reviewReasons).toContain("DUPLICATE_OWNER:สำเนา");
    });
});
