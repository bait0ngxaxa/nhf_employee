import { describe, expect, it } from "vitest";

import {
    parseITOperatorReferenceData,
    parseITOperatorTicket,
    parseITOperatorTicketDetail,
    parseITOperatorTicketList,
    parseITOperatorTicketMutationSnapshot,
    isITOperatorMutationVersionConflict,
    readITOperatorError,
    formatITTicketActivityTime,
    formatITTicketActivityTimestamp,
    describeITTicketActivityActor,
    describeITTicketActivityItem,
    mergeITTicketActivityItems,
    mergeITTicketConversationItems,
    parseITTicketActivityItem,
    parseITTicketActivityPage,
    parseITTicketConversationItem,
    parseITTicketConversationPage,
    parseITRequesterTicketDetail,
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
    it("formats compact Activity times in Bangkok time", () => {
        expect(formatITTicketActivityTime("2026-09-01T07:03:00.000Z")).toBe("14:03");
        expect(formatITTicketActivityTimestamp(
            "2026-09-01T07:03:00.000Z",
            "2026-09-01T01:00:00.000Z",
        )).toBe("14:03");
        expect(formatITTicketActivityTimestamp(
            "2026-09-01T17:03:00.000Z",
            "2026-09-01T01:00:00.000Z",
        )).toBe("2 ก.ย. 2569 · 00:03");
    });

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

    it("parses initial Ticket evidence through the detail-only safe summary", () => {
        const initialAttachments = [{
            id: "a".repeat(32),
            originalName: "หน้าจอ.png",
            contentType: "image/webp",
            sizeBytes: 2048,
            width: 640,
            height: 480,
            position: 0,
            storageKey: "it/private/path.webp",
            uploaderUserId: 41,
        }];
        const requester = parseITRequesterTicketDetail({
            ...operatorTicket,
            requester: undefined,
            initialAttachments,
            createdAt: operatorTicket.createdAt,
            resolvedAt: null,
        });
        const operator = parseITOperatorTicketDetail({ ...operatorTicket, initialAttachments });

        expect(requester?.initialAttachments).toEqual([{
            id: "a".repeat(32),
            originalName: "หน้าจอ.png",
            contentType: "image/webp",
            sizeBytes: 2048,
            width: 640,
            height: 480,
            position: 0,
        }]);
        expect(operator?.initialAttachments).toEqual(requester?.initialAttachments);
        expect(JSON.stringify(requester)).not.toMatch(/storageKey|uploaderUserId/);
        expect(parseITRequesterTicketDetail({
            ...operatorTicket,
            initialAttachments: [{ ...initialAttachments[0], width: 2401 }],
        })).toBeNull();
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

describe("IT Ticket conversation and activity presentation contracts", () => {
    const comment = {
        id: "cmtest123",
        createdAt: "2026-09-01T02:00:00.000Z",
        authorDisplayName: "อารี ใจเย็น",
        authorSide: "OPERATOR",
        body: "ตรวจสอบให้แล้วค่ะ",
        attachments: [],
    } as const;
    const created = {
        type: "CREATED",
        id: 4,
        occurredAt: "2026-09-01T01:00:00.000Z",
        actorDisplayName: "สมชาย ใจดี",
    } as const;

    it("parses comment-only conversation pages and rejects event rows", () => {
        expect(parseITTicketConversationPage({
            success: true,
            items: [{ ...comment, author: { password: "private" } }],
            olderCursor: "conversation-cursor",
            hasMore: true,
        })).toEqual({
            items: [comment],
            olderCursor: "conversation-cursor",
            hasMore: true,
        });
        expect(parseITTicketConversationItem(created)).toBeNull();
        expect(parseITTicketConversationPage({
            success: true,
            items: [],
            olderCursor: null,
            hasMore: true,
        })).toBeNull();
    });

    it("parses event-only activity pages and rejects comment rows", () => {
        expect(parseITTicketActivityPage({
            success: true,
            items: [{ ...created, actor: { email: "private@example.test" } }],
            olderCursor: "activity-cursor",
            hasMore: true,
        })).toEqual({
            items: [created],
            olderCursor: "activity-cursor",
            hasMore: true,
        });
        expect(parseITTicketActivityItem(comment)).toBeNull();
    });

    it("merges pages independently with stable ID ordering for equal timestamps", () => {
        const at = "2026-09-01T01:00:00.000Z";
        const conversation = mergeITTicketConversationItems([
            { ...comment, id: "cm02", createdAt: at },
            { ...comment, id: "cm01", createdAt: at },
        ]);
        const activity = mergeITTicketActivityItems([
            { type: "CREATED", id: 8, occurredAt: at, actorDisplayName: "ข" },
            { type: "CREATED", id: 7, occurredAt: at, actorDisplayName: "ก" },
        ]);

        expect(conversation.map((item) => item.id)).toEqual(["cm01", "cm02"]);
        expect(activity.map((item) => item.id)).toEqual([7, 8]);
        expect(conversation.every((item) => "body" in item)).toBe(true);
        expect(activity.every((item) => "occurredAt" in item)).toBe(true);
    });

    it("uses canonical Thai lifecycle wording and keeps LIFF assignment/category details private", () => {
        const reopen = {
            type: "STATUS_CHANGED",
            id: 9,
            occurredAt: "2026-09-01T02:00:00.000Z",
            actorDisplayName: "สมชาย",
            fromStatus: "RESOLVED",
            toStatus: "IN_PROGRESS",
        } as const;
        const assigned = {
            type: "ASSIGNED",
            id: 10,
            occurredAt: "2026-09-01T02:01:00.000Z",
            actorDisplayName: "สมชาย",
            fromAssigneeDisplayName: null,
            toAssigneeDisplayName: "อารี ใจเย็น",
        } as const;
        const category = {
            type: "CATEGORY_CHANGED",
            id: 11,
            occurredAt: "2026-09-01T02:02:00.000Z",
            actorDisplayName: "สมชาย",
            fromCategoryName: null,
            toCategoryName: "ข้อมูลภายใน",
        } as const;

        expect(describeITTicketActivityItem(reopen, "DASHBOARD")).toBe("เปิดงานอีกครั้ง");
        expect(describeITTicketActivityActor(reopen, "DASHBOARD")).toBe("สมชาย");
        expect(describeITTicketActivityActor(reopen, "LIFF")).toBe("เจ้าหน้าที่ IT");
        expect(describeITTicketActivityActor({ ...reopen, type: "CREATED" }, "LIFF")).toBe("คุณ");
        expect(describeITTicketActivityItem(assigned, "DASHBOARD")).toContain("อารี ใจเย็น");
        expect(describeITTicketActivityActor(assigned, "DASHBOARD")).toBe("สมชาย");
        expect(describeITTicketActivityItem(assigned, "LIFF")).not.toContain("อารี ใจเย็น");
        expect(describeITTicketActivityItem(category, "LIFF")).not.toContain("ข้อมูลภายใน");
        expect(describeITTicketActivityItem(category, "DASHBOARD")).toContain("ข้อมูลภายใน");
    });

    it("validates attachment summaries before exposing private image URLs to presentation", () => {
        const commentWithAttachment = {
            ...comment,
            authorSide: "REQUESTER",
            attachments: [{
                id: "a".repeat(32),
                originalName: "หลักฐาน.png",
                contentType: "image/webp",
                sizeBytes: 12_345,
                width: 800,
                height: 600,
                position: 0,
                storageKey: "it/19/private.webp",
            }],
        };
        const parsed = parseITTicketConversationItem(commentWithAttachment);
        expect(parsed).toMatchObject({
            attachments: [{ id: "a".repeat(32), originalName: "หลักฐาน.png" }],
        });
        expect(parsed).not.toHaveProperty("attachments.0.storageKey");

        for (const invalidAttachment of [
            { ...commentWithAttachment.attachments[0], id: "../private" },
            { ...commentWithAttachment.attachments[0], contentType: "image/png" },
            { ...commentWithAttachment.attachments[0], position: 3 },
            { ...commentWithAttachment.attachments[0], sizeBytes: 0 },
            { ...commentWithAttachment.attachments[0], width: 2401 },
            { ...commentWithAttachment.attachments[0], originalName: "../proof.png" },
            { ...commentWithAttachment.attachments[0], originalName: "   " },
            { ...commentWithAttachment.attachments[0], originalName: " proof.png " },
            { ...commentWithAttachment.attachments[0], originalName: "proof\u0085.png" },
        ]) {
            expect(parseITTicketConversationItem({
                ...commentWithAttachment,
                attachments: [invalidAttachment],
            })).toBeNull();
        }
        expect(parseITTicketConversationItem({
            ...commentWithAttachment,
            attachments: undefined,
        })).toBeNull();
    });
});
