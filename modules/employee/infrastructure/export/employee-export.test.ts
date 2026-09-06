import type { PrismaClient } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockDeep, mockReset } from "vitest-mock-extended";

import { prisma } from "@/lib/db/prisma";
import { createEmployeeExport } from "./employee-export";

vi.mock("@/lib/db/prisma", () => ({ prisma: mockDeep<PrismaClient>() }));
const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

describe("Employee CSV export", () => {
    beforeEach(() => mockReset(prismaMock));

    it("rejects more than 2000 matching rows", async () => {
        prismaMock.employee.count.mockResolvedValue(2001);
        await expect(createEmployeeExport({ page: 1, limit: 10 })).resolves.toEqual({
            status: "limit-exceeded",
            recordCount: 2001,
            maxRows: 2000,
        });
    });

    it("streams Thai headings and renders temporary email as dash in 250-row batches", async () => {
        prismaMock.employee.count.mockResolvedValue(251);
        prismaMock.employee.findMany
            .mockResolvedValueOnce([{
                firstName: "สมชาย",
                lastName: "ใจดี",
                nickname: null,
                position: "เจ้าหน้าที่",
                affiliation: null,
                email: "no-email-1@temp.local",
                phone: null,
                status: "ACTIVE",
                dept: { name: "บริหาร" },
            }] as never)
            .mockResolvedValueOnce([]);

        const result = await createEmployeeExport({ page: 1, limit: 10 });
        expect(result.status).toBe("ready");
        if (result.status !== "ready") return;
        const csv = await result.response.text();

        expect(csv).toContain("ลำดับ,ชื่อ,นามสกุล,ชื่อเล่น,ตำแหน่ง,สังกัด,แผนก,อีเมล,เบอร์โทร,สถานะ");
        expect(csv).toContain("1,สมชาย,ใจดี,-,เจ้าหน้าที่,-,บริหาร,-,-,ทำงานอยู่");
        expect(prismaMock.employee.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            skip: 0,
            take: 250,
        }));
        expect(prismaMock.employee.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
            skip: 250,
            take: 250,
        }));
    });
});
