import { type StockTxType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
    type AdjustStockInput,
    type CreateCategoryInput,
    type CreateItemInput,
    type CreateRequestInput,
    type StockItemsFilter,
    type StockRequestsFilter,
    type UpdateItemInput,
} from "@/lib/validations/stock";

const DEFAULT_STOCK_CATEGORY_NAME = "อุปกรณ์สำนักงาน";

type CreateStockItemInput = Omit<CreateItemInput, "sku" | "categoryId"> & {
    sku?: string;
    categoryId?: number;
};

function generateSku(): string {
    const time = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `SKU-${time}-${rand}`;
}

async function ensureDefaultCategoryId(): Promise<number> {
    const category = await prisma.stockCategory.upsert({
        where: { name: DEFAULT_STOCK_CATEGORY_NAME },
        update: {},
        create: { name: DEFAULT_STOCK_CATEGORY_NAME },
        select: { id: true },
    });
    return category.id;
}

async function getCategories() {
    await ensureDefaultCategoryId();
    return prisma.stockCategory.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { items: true } } },
    });
}

async function createCategory(data: CreateCategoryInput) {
    return prisma.stockCategory.create({ data });
}

async function deleteCategory(id: number) {
    return prisma.stockCategory.delete({ where: { id } });
}

async function getItems(filters: StockItemsFilter) {
    const { categoryId, search, activeOnly, page, limit } = filters;

    const where = {
        ...(categoryId !== undefined && { categoryId }),
        ...(activeOnly !== undefined && { isActive: activeOnly }),
        ...(search && {
            OR: [{ name: { contains: search } }, { sku: { contains: search } }],
        }),
    };

    const [items, total] = await Promise.all([
        prisma.stockItem.findMany({
            where,
            include: { category: { select: { id: true, name: true } } },
            orderBy: { name: "asc" },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.stockItem.count({ where }),
    ]);

    return { items, total, page, limit };
}

async function getItemById(id: number) {
    return prisma.stockItem.findUnique({
        where: { id },
        include: { category: { select: { id: true, name: true } } },
    });
}

async function createItem(data: CreateStockItemInput) {
    const categoryId = data.categoryId ?? (await ensureDefaultCategoryId());
    const sku = data.sku && data.sku.trim().length > 0 ? data.sku.trim() : generateSku();

    return prisma.stockItem.create({
        data: { ...data, categoryId, sku },
        include: { category: { select: { id: true, name: true } } },
    });
}

async function updateItem(id: number, data: UpdateItemInput) {
    return prisma.stockItem.update({
        where: { id },
        data,
        include: { category: { select: { id: true, name: true } } },
    });
}

async function adjustStock(itemId: number, input: AdjustStockInput, userId: number) {
    return prisma.$transaction(async (tx) => {
        const item = await tx.stockItem.findUnique({
            where: { id: itemId },
            select: { id: true, quantity: true, minStock: true },
        });

        if (!item) throw new Error("ไม่พบวัสดุ");

        const newQty = item.quantity + input.quantity;
        if (newQty < 0) throw new Error("ยอดคงเหลือต้องไม่ติดลบ");

        await tx.stockItem.update({
            where: { id: itemId },
            data: {
                quantity: newQty,
                minStock: input.minStock,
            },
        });

        await tx.stockTransaction.create({
            data: {
                itemId,
                type: input.type as StockTxType,
                quantity: input.quantity,
                note: null,
                performedBy: userId,
            },
        });

        return {
            itemId,
            previousQty: item.quantity,
            newQty,
            previousMinStock: item.minStock,
            newMinStock: input.minStock,
        };
    });
}

async function getRequests(filters: StockRequestsFilter, userId: number, isAdmin: boolean) {
    const { status, page, limit } = filters;

    const where = {
        ...(status !== undefined && { status }),
        ...(!isAdmin && { requestedBy: userId }),
    };

    const [requests, total] = await Promise.all([
        prisma.stockRequest.findMany({
            where,
            include: {
                requester: { select: { id: true, name: true, email: true } },
                reviewer: { select: { id: true, name: true } },
                items: {
                    include: {
                        item: {
                            select: { id: true, name: true, sku: true, unit: true },
                        },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.stockRequest.count({ where }),
    ]);

    return { requests, total, page, limit };
}

async function createRequest(data: CreateRequestInput, userId: number) {
    return prisma.stockRequest.create({
        data: {
            requestedBy: userId,
            note: data.note ?? null,
            items: {
                create: data.items.map((item) => ({
                    itemId: item.itemId,
                    quantity: item.quantity,
                })),
            },
        },
        include: {
            items: {
                include: {
                    item: {
                        select: { id: true, name: true, sku: true, unit: true },
                    },
                },
            },
        },
    });
}

async function approveRequest(requestId: number, adminId: number) {
    return prisma.$transaction(async (tx) => {
        const request = await tx.stockRequest.findUnique({
            where: { id: requestId },
            include: { items: true },
        });

        if (!request) throw new Error("ไม่พบคำขอเบิก");
        if (request.status !== "PENDING") throw new Error("คำขอนี้ถูกดำเนินการแล้ว");

        const requestedQtyByItemId = new Map<number, number>();
        for (const reqItem of request.items) {
            requestedQtyByItemId.set(
                reqItem.itemId,
                (requestedQtyByItemId.get(reqItem.itemId) ?? 0) + reqItem.quantity,
            );
        }

        const itemIds = Array.from(requestedQtyByItemId.keys());
        const items = await tx.stockItem.findMany({
            where: { id: { in: itemIds } },
            select: { id: true, name: true, unit: true, quantity: true },
        });
        const itemById = new Map(items.map((item) => [item.id, item]));

        for (const [itemId, requestedQty] of requestedQtyByItemId) {
            const item = itemById.get(itemId);
            if (!item) throw new Error("ไม่พบวัสดุ");
            if (item.quantity < requestedQty) {
                throw new Error(
                    `${item.name} มีไม่เพียงพอ (คงเหลือ: ${item.quantity} ${item.unit})`,
                );
            }
        }

        for (const [itemId, requestedQty] of requestedQtyByItemId) {
            const updated = await tx.stockItem.updateMany({
                where: {
                    id: itemId,
                    quantity: { gte: requestedQty },
                },
                data: { quantity: { decrement: requestedQty } },
            });
            if (updated.count === 0) {
                const item = await tx.stockItem.findUnique({
                    where: { id: itemId },
                    select: { name: true, unit: true, quantity: true },
                });
                if (!item) throw new Error("ไม่พบวัสดุ");
                throw new Error(
                    `${item.name} มีไม่เพียงพอ (คงเหลือ: ${item.quantity} ${item.unit})`,
                );
            }

            await tx.stockTransaction.create({
                data: {
                    itemId,
                    type: "OUT",
                    quantity: -requestedQty,
                    note: `เบิกตามคำขอ #${requestId}`,
                    performedBy: adminId,
                },
            });
        }

        return tx.stockRequest.update({
            where: { id: requestId },
            data: { status: "APPROVED", reviewedBy: adminId, reviewedAt: new Date() },
        });
    });
}

async function rejectRequest(requestId: number, adminId: number, reason?: string | null) {
    const request = await prisma.stockRequest.findUnique({
        where: { id: requestId },
        select: { status: true },
    });

    if (!request) throw new Error("ไม่พบคำขอเบิก");
    if (request.status !== "PENDING") throw new Error("คำขอนี้ถูกดำเนินการแล้ว");

    return prisma.stockRequest.update({
        where: { id: requestId },
        data: {
            status: "REJECTED",
            reviewedBy: adminId,
            reviewedAt: new Date(),
            rejectReason: reason ?? null,
        },
    });
}

export const stockService = {
    getCategories,
    createCategory,
    deleteCategory,
    getItems,
    getItemById,
    createItem,
    updateItem,
    adjustStock,
    getRequests,
    createRequest,
    approveRequest,
    rejectRequest,
};
