import { describe, expect, it } from "vitest";

import {
    parseITOperatorReferenceData,
    parseITOperatorTicket,
    parseITOperatorTicketList,
    parseITOperatorTicketMutationSnapshot,
    isITOperatorMutationVersionConflict,
    readITOperatorError,
    mergeITTicketTimelineItems,
    parseITTicketTimelinePage,
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

describe("IT Ticket timeline presentation contracts", () => {
    it("parses only browser-safe comment and event fields", () => {
        const payload = {
            success: true,
            items: [
                {
                    type: "CREATED",
                    id: 4,
                    createdAt: "2026-09-01T01:00:00.000Z",
                    actorDisplayName: "สมชาย ใจดี",
                    actor: { email: "private@example.test" },
                },
                {
                    type: "COMMENT",
                    id: "cmtest123",
                    createdAt: "2026-09-01T02:00:00.000Z",
                    authorDisplayName: "อารี ใจเย็น",
                    authorSide: "OPERATOR",
                    body: "ตรวจสอบให้แล้วค่ะ",
                    author: { password: "private" },
                },
            ],
            olderCursor: "eyJzb3VyY2UiOiJFVkVOVCJ9",
            hasMore: true,
        };
        const page = parseITTicketTimelinePage(payload);

        expect(page).toEqual({
            items: [
                {
                    type: "CREATED",
                    id: 4,
                    createdAt: "2026-09-01T01:00:00.000Z",
                    actorDisplayName: "สมชาย ใจดี",
                },
                {
                    type: "COMMENT",
                    id: "cmtest123",
                    createdAt: "2026-09-01T02:00:00.000Z",
                    authorDisplayName: "อารี ใจเย็น",
                    authorSide: "OPERATOR",
                    body: "ตรวจสอบให้แล้วค่ะ",
                },
            ],
            olderCursor: "eyJzb3VyY2UiOiJFVkVOVCJ9",
            hasMore: true,
        });
        expect(page?.items[0]).not.toHaveProperty("actor");
        expect(page?.items[1]).not.toHaveProperty("author");
        expect(parseITTicketTimelinePage({
            success: true,
            items: [],
            olderCursor: null,
            hasMore: true,
        })).toBeNull();
    });

    it("uses timestamp, event-before-comment, and stable source-id ordering for ties", () => {
        const at = "2026-09-01T01:00:00.000Z";
        const items = mergeITTicketTimelineItems([
            {
                type: "COMMENT",
                id: "cm02",
                createdAt: at,
                authorDisplayName: "ผู้แจ้ง",
                authorSide: "REQUESTER",
                body: "ข้อความ",
            },
            { type: "CREATED", id: 8, createdAt: at, actorDisplayName: "ก" },
            { type: "STATUS_CHANGED", id: 4, createdAt: at, actorDisplayName: "ข", fromStatus: "OPEN", toStatus: "IN_PROGRESS" },
            {
                type: "COMMENT",
                id: "cm01",
                createdAt: at,
                authorDisplayName: "เจ้าหน้าที่",
                authorSide: "OPERATOR",
                body: "ข้อความ",
            },
            { type: "CREATED", id: 7, createdAt: at, actorDisplayName: "ค" },
        ]);

        expect(items.map((item) => `${item.type}:${item.id}`)).toEqual([
            "STATUS_CHANGED:4",
            "CREATED:7",
            "CREATED:8",
            "COMMENT:cm01",
            "COMMENT:cm02",
        ]);
    });
});
