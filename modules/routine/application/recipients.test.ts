import { describe, expect, it, vi } from "vitest";

import { resolveRoutineNotificationRecipients } from "./recipients";
import type { AuthorizationPersistenceContext } from "@/modules/authorization";

function buildAssignee(userId: number) {
    return {
        employee: {
            firstName: "สมชาย",
            lastName: "ใจดี",
            nickname: null,
            status: "ACTIVE",
            deletedAt: null,
            user: {
                id: userId,
                name: "สมชาย ใจดี",
                email: "somchai@example.com",
                isActive: true,
                deletedAt: null,
            },
        },
    };
}

describe("Routine reminder recipients", () => {
    it("unions assignees with configured ALL readers and deduplicates by User ID", async () => {
        const findMany = vi.fn()
            .mockResolvedValueOnce([{ id: 17 }])
            .mockResolvedValueOnce([{
                id: 17,
                name: "สมชาย ใจดี",
                email: "somchai@example.com",
                employee: null,
            }]);
        const context = {
            user: { findMany },
            userCapabilityGrant: {
                findMany: vi.fn().mockResolvedValue([{
                    userId: 17,
                    capabilityKey: "routine.task.read",
                    scope: "ALL",
                }]),
            },
            teamMembership: { findMany: vi.fn().mockResolvedValue([]) },
            teamRoleCapabilityGrant: { findMany: vi.fn().mockResolvedValue([]) },
        } as unknown as AuthorizationPersistenceContext;

        const recipients = await resolveRoutineNotificationRecipients(
            context,
            "ASSIGNEES_AND_ALL_READERS",
            [buildAssignee(17)],
        );

        expect(recipients.activeRecipients).toEqual([{
            userId: 17,
            email: "somchai@example.com",
            name: "สมชาย ใจดี",
            isAssignee: true,
        }]);
        expect(findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
            where: expect.objectContaining({
                isActive: true,
                deletedAt: null,
                OR: expect.arrayContaining([
                    expect.objectContaining({
                        userCapabilityGrants: {
                            some: {
                                capabilityKey: "routine.task.read",
                                scope: "ALL",
                            },
                        },
                    }),
                ]),
            }),
            select: { id: true },
            orderBy: { id: "asc" },
        }));
    });

    it("does not treat the CREATED/ASSIGNED default policy as ALL reader authority", async () => {
        const findMany = vi.fn().mockResolvedValue([]);
        const context = {
            user: { findMany },
            userCapabilityGrant: { findMany: vi.fn().mockResolvedValue([]) },
            teamMembership: { findMany: vi.fn().mockResolvedValue([]) },
            teamRoleCapabilityGrant: { findMany: vi.fn().mockResolvedValue([]) },
        } as unknown as AuthorizationPersistenceContext;

        await expect(resolveRoutineNotificationRecipients(
            context,
            "ALL_READERS",
            [],
        )).resolves.toEqual({
            activeRecipients: [],
            emailRecipients: [],
        });
        expect(findMany).toHaveBeenCalledTimes(1);
    });

    it("does not return inactive or deleted configured reader identities", async () => {
        const findMany = vi.fn()
            .mockResolvedValueOnce([{ id: 18 }, { id: 19 }])
            .mockResolvedValueOnce([]);
        const context = {
            user: { findMany },
            userCapabilityGrant: {
                findMany: vi.fn().mockResolvedValue([
                    {
                        userId: 18,
                        capabilityKey: "routine.task.read",
                        scope: "ALL",
                    },
                    {
                        userId: 19,
                        capabilityKey: "routine.task.read",
                        scope: "ALL",
                    },
                ]),
            },
            teamMembership: { findMany: vi.fn().mockResolvedValue([]) },
            teamRoleCapabilityGrant: { findMany: vi.fn().mockResolvedValue([]) },
        } as unknown as AuthorizationPersistenceContext;

        await expect(resolveRoutineNotificationRecipients(
            context,
            "ALL_READERS",
            [],
        )).resolves.toEqual({
            activeRecipients: [],
            emailRecipients: [],
        });
        expect(findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
            where: {
                id: { in: [18, 19] },
                isActive: true,
                deletedAt: null,
            },
        }));
    });
});
