// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
    AUTH_CREDENTIALS_MAX_REQUEST_BYTES,
    DEFAULT_JSON_MUTATION_MAX_BYTES,
    EMPLOYEE_IMPORT_CSV_MAX_FILE_BYTES,
    EMPLOYEE_IMPORT_JSON_MAX_REQUEST_BYTES,
    EMPLOYEE_IMPORT_LIMIT_BASIS_ROWS,
    EMPLOYEE_IMPORT_ROW_JSON_OVERHEAD_BYTES,
    LEAVE_APPROVERS_JSON_MAX_REQUEST_BYTES,
    STOCK_ITEM_JSON_MAX_REQUEST_BYTES,
} from "@/lib/ssot/request-limits";
import {
    createEmployeeSchema,
    EMPLOYEE_IMPORT_MAX_ROWS,
    updateEmployeeSchema,
} from "@/modules/employee";
import {
    addAuthorizationTeamMemberSchema,
    authorizationCapabilityGrantSchema,
    changeAuthorizationTeamMemberRoleSchema,
    createAuthorizationTeamRoleSchema,
    createAuthorizationTeamSchema,
    updateAuthorizationTeamRoleSchema,
    updateAuthorizationTeamSchema,
} from "@/modules/authorization";
import {
    assignITTicketBodySchema,
    setITTicketCategoryBodySchema,
    setITTicketPriorityBodySchema,
} from "@/modules/it";
import {
    adjustStockSchema,
    createCategorySchema,
    createItemSchema,
    updateItemSchema,
} from "@/modules/stock";
import {
    LEAVE_APPROVER_ASSIGNMENTS_MAX,
    leaveApproverAssignmentsSchema,
} from "@/modules/leave";
import {
    buildMaximalCreateItemPayload,
    buildMaximalUpdateItemPayload,
} from "@/__tests__/helpers/maximal-stock-payloads";
import { utf8ByteLength } from "@/__tests__/helpers/request-body-limit";

interface SafeParser {
    safeParse(value: unknown): { success: boolean };
}

function expectFits(schema: SafeParser, payload: unknown, limit: number): number {
    expect(schema.safeParse(payload).success).toBe(true);
    const bytes = utf8ByteLength(JSON.stringify(payload));
    expect(bytes).toBeLessThanOrEqual(limit);
    return bytes;
}

const THAI = (length: number): string => "ก".repeat(length);
const MAX_INT = Number.MAX_SAFE_INTEGER;

describe("request body limit derivations", () => {
    it("fits the maximal schema-valid Stock item create and update payloads", () => {
        const createBytes = expectFits(
            createItemSchema,
            buildMaximalCreateItemPayload(),
            STOCK_ITEM_JSON_MAX_REQUEST_BYTES,
        );
        const updateBytes = expectFits(
            updateItemSchema,
            buildMaximalUpdateItemPayload(),
            STOCK_ITEM_JSON_MAX_REQUEST_BYTES,
        );

        // The override is required: the module's 32 KiB Stock default is far too small.
        expect(Math.max(createBytes, updateBytes)).toBeGreaterThan(32 * 1024);
    });

    it("fits the maximal schema-valid small mutations in the shared default", () => {
        const name191 = "ก".repeat(191);
        const cases: Array<[string, SafeParser, unknown]> = [
            ["stock category", createCategorySchema, { name: THAI(100), description: THAI(500) }],
            ["stock adjust", adjustStockSchema, {
                variantId: MAX_INT, type: "IN", quantity: MAX_INT, minStock: MAX_INT,
            }],
            ["employee create", createEmployeeSchema, {
                firstName: THAI(100),
                lastName: THAI(100),
                nickname: THAI(50),
                email: `${"a".repeat(64)}@${"b".repeat(185)}.org`,
                phone: "0".repeat(10),
                position: THAI(200),
                affiliation: THAI(200),
                departmentId: MAX_INT,
            }],
            ["employee update", updateEmployeeSchema, {
                firstName: THAI(100),
                lastName: THAI(100),
                nickname: THAI(50),
                email: `${"a".repeat(64)}@${"b".repeat(185)}.org`,
                position: THAI(200),
                affiliation: THAI(200),
                departmentId: MAX_INT,
            }],
            ["authorization team", createAuthorizationTeamSchema, {
                key: "a".repeat(191), name: name191, description: name191,
            }],
            ["authorization team update", updateAuthorizationTeamSchema, {
                name: name191, description: name191, isActive: false,
            }],
            ["authorization team role", createAuthorizationTeamRoleSchema, {
                key: "a".repeat(191), name: name191,
            }],
            ["authorization team role update", updateAuthorizationTeamRoleSchema, {
                name: name191, isActive: false,
            }],
            ["authorization member", addAuthorizationTeamMemberSchema, { userId: MAX_INT, teamRoleId: MAX_INT }],
            ["authorization member role", changeAuthorizationTeamMemberRoleSchema, { teamRoleId: MAX_INT }],
            ["authorization grant", authorizationCapabilityGrantSchema, {
                capabilityKey: "a".repeat(191), scope: "a".repeat(191),
            }],
            ["IT assign", assignITTicketBodySchema, { assigneeUserId: 2147483647, expectedVersion: 2147483647 }],
            ["IT category", setITTicketCategoryBodySchema, { categoryId: 2147483647, expectedVersion: 2147483647 }],
            ["IT priority", setITTicketPriorityBodySchema, {
                priority: "P0", reason: THAI(500), expectedVersion: 2147483647,
            }],
        ];

        for (const [label, schema, payload] of cases) {
            const parsed = schema.safeParse(payload);
            expect(parsed.success, label).toBe(true);
            expect(utf8ByteLength(JSON.stringify(payload)), label)
                .toBeLessThanOrEqual(DEFAULT_JSON_MUTATION_MAX_BYTES / 2);
        }
    });

    it("keeps credential payloads well inside the pre-auth limit", () => {
        const maximalLogin = {
            email: `${"a".repeat(64)}@${"b".repeat(185)}.org`,
            // bcrypt only uses the first 72 bytes; allow 10× that.
            password: "x".repeat(720),
            confirmPassword: "x".repeat(720),
            token: "f".repeat(64),
        };
        expect(utf8ByteLength(JSON.stringify(maximalLogin))).toBeLessThan(AUTH_CREDENTIALS_MAX_REQUEST_BYTES);
    });

    it("derives the Employee import limit from the CSV cap and the server row cap", () => {
        expect(EMPLOYEE_IMPORT_LIMIT_BASIS_ROWS).toBe(EMPLOYEE_IMPORT_MAX_ROWS);
        expect(EMPLOYEE_IMPORT_JSON_MAX_REQUEST_BYTES).toBe(
            2 * EMPLOYEE_IMPORT_CSV_MAX_FILE_BYTES
            + EMPLOYEE_IMPORT_MAX_ROWS * EMPLOYEE_IMPORT_ROW_JSON_OVERHEAD_BYTES,
        );

        // The per-row allowance covers every CSV-mapped key plus punctuation.
        const keyOverheadRow = JSON.stringify({
            sourceRow: MAX_INT,
            firstName: "",
            lastName: "",
            email: "",
            phone: "",
            position: "",
            department: "",
            affiliation: "",
            nickname: "",
            hireDate: "",
            status: "",
        }) + ",";
        expect(utf8ByteLength(keyOverheadRow)).toBeLessThan(EMPLOYEE_IMPORT_ROW_JSON_OVERHEAD_BYTES);
    });
    it("fits the maximal schema-valid Leave approver payload and rejects one over the cap", () => {
        // Employee ids are MySQL INT, so the largest real id has 10 digits.
        const largestAssignment = { employeeId: 2147483647, managerId: 2147483647 };
        expect(utf8ByteLength(`${JSON.stringify(largestAssignment)},`)).toBe(49);
        expect(LEAVE_APPROVER_ASSIGNMENTS_MAX * 49 + 1024).toBeLessThanOrEqual(
            LEAVE_APPROVERS_JSON_MAX_REQUEST_BYTES,
        );

        const build = (count: number): { assignments: Array<typeof largestAssignment> } => ({
            assignments: Array.from({ length: count }, (_unused, index) => ({
                employeeId: largestAssignment.employeeId - index,
                managerId: largestAssignment.managerId,
            })),
        });

        expectFits(
            leaveApproverAssignmentsSchema,
            build(LEAVE_APPROVER_ASSIGNMENTS_MAX),
            LEAVE_APPROVERS_JSON_MAX_REQUEST_BYTES,
        );
        expect(leaveApproverAssignmentsSchema.safeParse(build(LEAVE_APPROVER_ASSIGNMENTS_MAX + 1)).success)
            .toBe(false);
    });
});
