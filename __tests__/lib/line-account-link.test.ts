import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
    prismaMock: {
        lineAccountLink: {
            findUnique: vi.fn(),
            create: vi.fn(),
        },
    },
}));

vi.mock("@/lib/db/prisma", () => ({
    prisma: prismaMock,
}));

import {
    LineAccountLinkConflictError,
    linkLineAccount,
} from "@/lib/line/account-link";

describe("LINE account link persistence", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        prismaMock.lineAccountLink.findUnique.mockResolvedValue(null);
        prismaMock.lineAccountLink.create.mockResolvedValue({ id: "link-1" });
    });

    it("creates a new link when neither identity is linked", async () => {
        await expect(linkLineAccount(10, "line-a")).resolves.toEqual({
            idempotent: false,
        });

        expect(prismaMock.lineAccountLink.create).toHaveBeenCalledWith({
            data: { userId: 10, lineUserId: "line-a" },
            select: { id: true },
        });
    });

    it("treats the same relationship as an idempotent success", async () => {
        prismaMock.lineAccountLink.findUnique.mockResolvedValue({
            userId: 10,
            lineUserId: "line-a",
        });

        await expect(linkLineAccount(10, "line-a")).resolves.toEqual({
            idempotent: true,
        });
        expect(prismaMock.lineAccountLink.create).not.toHaveBeenCalled();
    });

    it("rejects a LINE identity already owned by another NHF user", async () => {
        prismaMock.lineAccountLink.findUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ userId: 20, lineUserId: "line-a" });

        await expect(linkLineAccount(10, "line-a")).rejects.toBeInstanceOf(
            LineAccountLinkConflictError,
        );
        expect(prismaMock.lineAccountLink.create).not.toHaveBeenCalled();
    });

    it("rejects an NHF user already linked to another LINE identity", async () => {
        prismaMock.lineAccountLink.findUnique
            .mockResolvedValueOnce({ userId: 10, lineUserId: "line-a" })
            .mockResolvedValueOnce(null);

        await expect(linkLineAccount(10, "line-b")).rejects.toBeInstanceOf(
            LineAccountLinkConflictError,
        );
        expect(prismaMock.lineAccountLink.create).not.toHaveBeenCalled();
    });

    it("treats an exact concurrent winner as an idempotent success", async () => {
        const exactLink = { userId: 10, lineUserId: "line-a" };
        prismaMock.lineAccountLink.findUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(exactLink)
            .mockResolvedValueOnce(exactLink);
        prismaMock.lineAccountLink.create.mockRejectedValueOnce({
            code: "P2002",
        });

        await expect(linkLineAccount(10, "line-a")).resolves.toEqual({
            idempotent: true,
        });
    });

    it("maps a unique constraint race to a conflict when another link wins", async () => {
        prismaMock.lineAccountLink.findUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ userId: 10, lineUserId: "line-b" })
            .mockResolvedValueOnce({ userId: 20, lineUserId: "line-a" });
        prismaMock.lineAccountLink.create.mockRejectedValueOnce({
            code: "P2002",
        });

        await expect(linkLineAccount(10, "line-a")).rejects.toBeInstanceOf(
            LineAccountLinkConflictError,
        );
    });
});
