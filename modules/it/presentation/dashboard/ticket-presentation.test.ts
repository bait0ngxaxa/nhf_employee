import { describe, expect, it } from "vitest";

import {
    parseITOperatorReferenceData,
    parseITOperatorTicket,
    parseITOperatorTicketList,
    parseITOperatorTicketMutationSnapshot,
    isITOperatorMutationVersionConflict,
    readITOperatorError,
} from "./ticket-presentation";

const operatorTicket = {
    id: 19,
    type: "INCIDENT",
    title: "เข้าใช้งานระบบไม่ได้",
    description: "หน้าเข้าสู่ระบบแสดงข้อผิดพลาด",
    status: "IN_PROGRESS",
    requester: {
        userId: 41,
        displayName: "สมชาย ใจดี (ชาย)",
        departmentId: 9,
        departmentNameSnapshot: "แผนกตัวอย่าง",
    },
    assignee: { userId: 51, displayName: "อารี ใจเย็น" },
    category: { id: 7, key: "NETWORK", name: "เครือข่าย", isActive: false },
    version: 4,
    createdAt: "2026-09-01T01:00:00.000Z",
    updatedAt: "2026-09-02T02:00:00.000Z",
    resolvedAt: null,
};

describe("IT operator presentation contracts", () => {
    it("parses the operator DTO including a historical inactive category", () => {
        expect(parseITOperatorTicket(operatorTicket)).toEqual(operatorTicket);
        expect(parseITOperatorTicket(operatorTicket)).not.toHaveProperty("events");
    });

    it("rejects incomplete identities and invalid versions", () => {
        expect(parseITOperatorTicket({
            ...operatorTicket,
            requester: { userId: 41 },
        })).toBeNull();
        expect(parseITOperatorTicket({ ...operatorTicket, version: 0 })).toBeNull();
    });

    it("parses a bounded cursor list and rejects an unbounded or malformed response", () => {
        expect(parseITOperatorTicketList({
            success: true,
            tickets: [operatorTicket],
            nextCursor: "eyJpZCI6MTl9",
            limit: 25,
        })).toMatchObject({ nextCursor: "eyJpZCI6MTl9", limit: 25 });
        expect(parseITOperatorTicketList({
            success: true,
            tickets: [operatorTicket],
            nextCursor: null,
            limit: 0,
        })).toBeNull();
        expect(parseITOperatorTicketList({
            success: true,
            tickets: [operatorTicket],
            nextCursor: null,
            limit: 101,
        })).toBeNull();
        expect(parseITOperatorTicketList({
            success: true,
            tickets: [operatorTicket, operatorTicket],
            nextCursor: null,
            limit: 1,
        })).toBeNull();
    });

    it("parses only safe active category and assignable-operator presentation fields", () => {
        expect(parseITOperatorReferenceData({
            success: true,
            categories: [{ id: 7, key: "NETWORK", name: "เครือข่าย" }],
            assignableOperators: [{ userId: 51, employeeId: 91, displayName: "อารี ใจเย็น" }],
            grants: [{ capability: "it.ticket.manage", scope: "ALL" }],
        })).toEqual({
            categories: [{ id: 7, key: "NETWORK", name: "เครือข่าย" }],
            assignableOperators: [{ userId: 51, employeeId: 91, displayName: "อารี ใจเย็น" }],
        });
    });

    it("uses the canonical mutation snapshot and Thai conflict feedback", () => {
        expect(parseITOperatorTicketMutationSnapshot({
            success: true,
            changed: true,
            ticket: {
                id: 19,
                version: 5,
                status: "IN_PROGRESS",
                assignedToUserId: 51,
                categoryId: 7,
                updatedAt: "2026-09-02T03:00:00.000Z",
            },
        })).toMatchObject({ changed: true, ticket: { id: 19, version: 5 } });
        expect(readITOperatorError({ error: "Ticket เปลี่ยนแปลงแล้ว" }, 409, true))
            .toBe("Ticket เปลี่ยนแปลงแล้ว");
        expect(isITOperatorMutationVersionConflict({
            code: "MUTATION_CONFLICT",
            reason: "STALE_VERSION",
        })).toBe(true);
        expect(isITOperatorMutationVersionConflict({ code: "CATEGORY_INACTIVE" })).toBe(false);
    });
});
