import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";
import type { PrismaClient } from "@prisma/client";
import type * as AuthorizationModule from "@/modules/authorization";
import { prisma } from "@/lib/db/prisma";
import { authorization } from "@/modules/authorization";
import { updateEmailRequestAccessRequirements } from "./commands";
import { EmailRequestAccessConflictError } from "./access-errors";

vi.mock("@/lib/db/prisma", () => ({ prisma: mockDeep<PrismaClient>() }));
vi.mock("@/modules/authorization", async (original) => ({ ...await original<typeof AuthorizationModule>(),
    authorization: { resolveInTransaction: vi.fn() } }));
const db = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;
const actor = { id: 7, email: "requester@example.com", role: "USER" };
const current = { id: 128, thaiName: "สมชาย", englishName: "Somchai", nickname: "ชาย", phone: "081-2345678", position: "IT", department: "มสช.",
    replyEmail: "reply@example.com", requestedBy: 7, needsDocumentSystem: false,
    documentSystemDecision: "UNDECIDED" as const, sharedDriveDecision: "UNDECIDED" as const, sharedDriveAccess: [], accessVersion: 1,
    createdAt: new Date(), updatedAt: new Date() };
const input = { documentSystemDecision: "REQUIRED", sharedDriveDecision: "REQUIRED", sharedDriveAccess: ["support", "it"], expectedAccessVersion: 1 };

function grant(scopes: readonly ("OWN" | "ALL")[]): void {
    vi.mocked(authorization.resolveInTransaction).mockResolvedValue({ capability: "email.request.update", allowed: scopes.length > 0, scopes, grants: [],
        ...(scopes.length ? {} : { reason: "NO_APPLICABLE_GRANT" as const }) });
}

describe("Email Request access command", () => {
    beforeEach(() => {
        mockReset(db);
        vi.mocked(authorization.resolveInTransaction).mockReset();
        grant(["OWN"]);
        db.$transaction.mockImplementation(async (operation) => {
            if (Array.isArray(operation)) return Promise.all(operation);
            return operation(db);
        });
        db.emailRequest.findUnique.mockResolvedValue(current);
        db.emailRequest.updateMany.mockResolvedValue({ count: 1 });
    });
    it.each(["OWN", "ALL"] as const)("permits configured %s and atomically writes version, history, audit and notification", async (scope) => {
        grant([scope]);
        db.emailRequest.findUnique.mockResolvedValueOnce(current).mockResolvedValueOnce({ ...current, documentSystemDecision: "REQUIRED", sharedDriveDecision: "REQUIRED", sharedDriveAccess: ["it", "support"], accessVersion: 2 });
        expect(await updateEmailRequestAccessRequirements(128, input, actor)).toMatchObject({ changed: true, emailRequest: { accessVersion: 2 } });
        expect(db.emailRequest.updateMany).toHaveBeenCalledWith({ where: { id: 128, accessVersion: 1 }, data: {
            documentSystemDecision: "REQUIRED", sharedDriveDecision: "REQUIRED", sharedDriveAccess: ["it", "support"], needsDocumentSystem: true, accessVersion: 2 } });
        expect(db.emailRequestAccessChange.create).toHaveBeenCalledWith({ data: { emailRequestId: 128, actorId: 7, accessVersion: 2,
            before: { documentSystemDecision: "UNDECIDED", sharedDriveDecision: "UNDECIDED", sharedDriveAccess: [] },
            after: { documentSystemDecision: "REQUIRED", sharedDriveDecision: "REQUIRED", sharedDriveAccess: ["it", "support"] } } });
        expect(db.notificationOutbox.create).toHaveBeenCalledWith({ data: { type: "EMAIL_REQUEST_ACCESS_UPDATED", eventKey: "email-request:128:access:2",
            payload: JSON.stringify({ version: 1, emailRequestId: 128, accessVersion: 2 }) } });
        expect(db.auditLog.create).toHaveBeenCalledTimes(1);
    });
    it("denies OWN on another request and denies missing grants", async () => {
        db.emailRequest.findUnique.mockResolvedValue({ ...current, requestedBy: 8 });
        await expect(updateEmailRequestAccessRequirements(128, input, actor)).rejects.toMatchObject({ statusCode: 403 });
        grant([]);
        await expect(updateEmailRequestAccessRequirements(128, input, actor)).rejects.toMatchObject({ statusCode: 403 });
        expect(db.emailRequest.updateMany).not.toHaveBeenCalled();
    });
    it("ALL can update another request", async () => {
        grant(["ALL"]);
        db.emailRequest.findUnique.mockResolvedValue({ ...current, requestedBy: 8 });
        expect(await updateEmailRequestAccessRequirements(128, input, actor)).toMatchObject({ changed: true });
    });
    it("conflicts on an old version, including identical-state retries", async () => {
        db.emailRequest.findUnique.mockResolvedValue({ ...current, accessVersion: 2 });
        await expect(updateEmailRequestAccessRequirements(128, { ...input, documentSystemDecision: "UNDECIDED", sharedDriveDecision: "UNDECIDED", sharedDriveAccess: [] }, actor)).rejects.toBeInstanceOf(EmailRequestAccessConflictError);
        expect(db.notificationOutbox.create).not.toHaveBeenCalled();
    });
    it("conflicts when the compare-and-swap loses a race", async () => {
        db.emailRequest.updateMany.mockResolvedValue({ count: 0 });
        await expect(updateEmailRequestAccessRequirements(128, input, actor)).rejects.toBeInstanceOf(EmailRequestAccessConflictError);
        expect(db.emailRequestAccessChange.create).not.toHaveBeenCalled();
    });
    it("normalizes no-op without any write", async () => {
        db.emailRequest.findUnique.mockResolvedValue({ ...current, documentSystemDecision: "REQUIRED", sharedDriveDecision: "REQUIRED", sharedDriveAccess: ["it", "support"] });
        expect(await updateEmailRequestAccessRequirements(128, input, actor)).toMatchObject({ changed: false, emailRequest: { accessVersion: 1 } });
        expect(db.emailRequest.updateMany).not.toHaveBeenCalled();
        expect(db.emailRequestAccessChange.create).not.toHaveBeenCalled();
        expect(db.notificationOutbox.create).not.toHaveBeenCalled();
        expect(db.auditLog.create).not.toHaveBeenCalled();
    });
    it("rejects contradictory state before opening a transaction", async () => {
        await expect(updateEmailRequestAccessRequirements(128, { ...input, sharedDriveDecision: "UNDECIDED" }, actor)).rejects.toThrow();
        expect(db.$transaction).not.toHaveBeenCalled();
    });
    it("propagates durable history and outbox failures so the transaction rolls back", async () => {
        db.emailRequestAccessChange.create.mockRejectedValueOnce(new Error("history unavailable"));
        await expect(updateEmailRequestAccessRequirements(128, input, actor)).rejects.toThrow("history unavailable");
        expect(db.notificationOutbox.create).not.toHaveBeenCalled();
        db.notificationOutbox.create.mockRejectedValueOnce(new Error("outbox unavailable"));
        await expect(updateEmailRequestAccessRequirements(128, input, actor)).rejects.toThrow("outbox unavailable");
    });
});
