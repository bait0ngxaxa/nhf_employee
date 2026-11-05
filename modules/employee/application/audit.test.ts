import { beforeEach, describe, expect, it, vi } from "vitest";

import { appendAuditBestEffort } from "@/modules/audit";
import {
    appendEmployeeCreateAudit,
    appendEmployeeDeleteAudit,
    appendEmployeeUpdateAudit,
} from "./audit";

vi.mock("@/modules/audit", () => ({
    appendAuditBestEffort: vi.fn(),
}));

const actor = {
    userId: 99,
    email: "admin@thainhf.org",
    ipAddress: "203.0.113.10",
    userAgent: "employee-audit-test",
};

describe("Employee Audit producers", () => {
    beforeEach(() => {
        vi.mocked(appendAuditBestEffort).mockReset();
    });

    it("preserves the Employee create payload and actor metadata", async () => {
        const hireDate = new Date("2023-04-01T00:00:00.000Z");
        await appendEmployeeCreateAudit({
            id: 12,
            firstName: "สมชาย",
            lastName: "ใจดี",
            nickname: "ชาย",
            email: "somchai@thainhf.org",
            position: "เจ้าหน้าที่",
            departmentId: 4,
            hireDate,
        }, actor);

        expect(appendAuditBestEffort).toHaveBeenCalledWith({
            action: "EMPLOYEE_CREATE",
            entityType: "Employee",
            entityId: 12,
            userId: 99,
            userEmail: "admin@thainhf.org",
            ipAddress: "203.0.113.10",
            userAgent: "employee-audit-test",
            details: {
                after: {
                    firstName: "สมชาย",
                    lastName: "ใจดี",
                    nickname: "ชาย",
                    email: "somchai@thainhf.org",
                    position: "เจ้าหน้าที่",
                    departmentId: 4,
                    hireDate,
                },
                metadata: { employeeName: "สมชาย ใจดี (ชาย)" },
            },
        });
    });

    it("records a nullable hire date when a created Employee has no known date", async () => {
        await appendEmployeeCreateAudit({
            id: 13,
            firstName: "สมหญิง",
            lastName: "ใจดี",
            nickname: null,
            email: "somying@thainhf.org",
            position: "เจ้าหน้าที่",
            departmentId: 4,
            hireDate: null,
        }, actor);

        expect(appendAuditBestEffort).toHaveBeenCalledWith(expect.objectContaining({
            details: expect.objectContaining({
                after: expect.objectContaining({ hireDate: null }),
            }),
        }));
    });

    it("keeps fallback update action selection and before/after payloads", async () => {
        await appendEmployeeUpdateAudit({
            employeeId: 12,
            actor,
            before: { status: "ACTIVE", position: "เจ้าหน้าที่" },
            after: { status: "SUSPENDED" },
            employee: {
                firstName: "สมชาย",
                lastName: "ใจดี",
                nickname: null,
            },
            statusChanged: true,
        });

        expect(appendAuditBestEffort).toHaveBeenCalledWith({
            action: "EMPLOYEE_STATUS_CHANGE",
            entityType: "Employee",
            entityId: 12,
            userId: 99,
            userEmail: "admin@thainhf.org",
            ipAddress: "203.0.113.10",
            userAgent: "employee-audit-test",
            details: {
                before: { status: "ACTIVE", position: "เจ้าหน้าที่" },
                after: { status: "SUSPENDED" },
                metadata: { employeeName: "สมชาย ใจดี" },
            },
        });
    });

    it("keeps the delete fallback payload feature-owned", async () => {
        await appendEmployeeDeleteAudit({
            employeeId: 12,
            actor,
            before: { status: "ACTIVE", deletedAt: null },
        });

        expect(appendAuditBestEffort).toHaveBeenCalledWith({
            action: "EMPLOYEE_DELETE",
            entityType: "Employee",
            entityId: 12,
            userId: 99,
            userEmail: "admin@thainhf.org",
            ipAddress: "203.0.113.10",
            userAgent: "employee-audit-test",
            details: {
                before: { status: "ACTIVE", deletedAt: null },
            },
        });
    });
});
