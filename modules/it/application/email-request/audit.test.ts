import { describe, expect, it } from "vitest";

import { buildEmailRequestCreationAuditEvent } from "./audit";

describe("Email Request Audit producer", () => {
    it("retains the existing action, actor, entity, and selected after fields", () => {
        expect(buildEmailRequestCreationAuditEvent({
            thaiName: "สมชาย ใจดี",
            englishName: "Somchai Jaidee",
            phone: "081-2345678",
            nickname: "ชาย",
            position: "เจ้าหน้าที่",
            department: "มสช.",
            replyEmail: "somchai@example.com",
            needsDocumentSystem: true,
            sharedDriveAccess: ["it"],
        }, {
            id: 17,
            email: "requester@example.com",
        }, 29)).toEqual({
            action: "EMAIL_REQUEST",
            entityType: "EmailRequest",
            entityId: 29,
            userId: 17,
            userEmail: "requester@example.com",
            details: {
                after: {
                    thaiName: "สมชาย ใจดี",
                    englishName: "Somchai Jaidee",
                    position: "เจ้าหน้าที่",
                    department: "มสช.",
                    needsDocumentSystem: true,
                    sharedDriveAccess: ["it"],
                },
            },
        });
    });
});
