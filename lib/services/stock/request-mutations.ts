import { Prisma, StockRequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
    CreateRequestInput,
} from "@/lib/validations/stock";
import {
    buildRequestInclude,
    buildReservedQuantityMaps,
    ensureDefaultVariantsByItemIds,
    getAvailableQuantity,
    normalizeRequestItems,
} from "./shared";
import type { CancelRequestOptions } from "./types";

export async function createRequest(
    data: CreateRequestInput,
    userId: number,
) {
    return prisma.$transaction(
        async (tx) => {
            const requestedVariantIds = data.items
                .map((item) => item.variantId)
                .filter((variantId): variantId is number => variantId !== undefined);
            const requestedItemIds = data.items
                .map((item) => item.itemId)
                .filter((itemId): itemId is number => itemId !== undefined);

            const variants = requestedVariantIds.length
                ? await tx.stockItemVariant.findMany({
                      where: { id: { in: requestedVariantIds } },
                      select: { id: true, stockItemId: true },
                  })
                : [];
            const itemIdByVariantId = new Map(
                variants.map((variant) => [variant.id, variant.stockItemId]),
            );
            const defaultVariantsByItemId = await ensureDefaultVariantsByItemIds(
                tx,
                requestedItemIds,
            );
            const normalizedItems = normalizeRequestItems(
                data,
                itemIdByVariantId,
                defaultVariantsByItemId,
            );
            const requestedQtyByVariantId = new Map<
                number,
                { itemId: number; quantity: number }
            >();

            for (const item of normalizedItems) {
                const existing = requestedQtyByVariantId.get(item.variantId);
                requestedQtyByVariantId.set(item.variantId, {
                    itemId: item.itemId,
                    quantity: (existing?.quantity ?? 0) + item.quantity,
                });
            }

            const variantIds = Array.from(requestedQtyByVariantId.keys());
            const [requestedVariants, pendingRequestItems] = await Promise.all([
                tx.stockItemVariant.findMany({
                    where: { id: { in: variantIds } },
                    select: {
                        id: true,
                        quantity: true,
                        unit: true,
                        stockItem: { select: { name: true } },
                    },
                }),
                tx.stockRequestItem.findMany({
                    where: {
                        itemId: {
                            in: Array.from(
                                new Set(normalizedItems.map((item) => item.itemId)),
                            ),
                        },
                        request: { status: StockRequestStatus.PENDING_ISSUE },
                    },
                    select: {
                        itemId: true,
                        variantId: true,
                        quantity: true,
                    },
                }),
            ]);
            const defaultVariantIdByItemId = new Map(
                Array.from(defaultVariantsByItemId.entries()).map(
                    ([itemId, variant]) => [itemId, variant.id] as const,
                ),
            );
            const { reservedByVariantId } = buildReservedQuantityMaps(
                pendingRequestItems,
                defaultVariantIdByItemId,
            );
            const requestedVariantById = new Map(
                requestedVariants.map((variant) => [variant.id, variant]),
            );

            for (const [variantId, requestItem] of requestedQtyByVariantId) {
                const variant = requestedVariantById.get(variantId);
                if (!variant) {
                    throw new Error("กรุณาเลือกรายการวัสดุ");
                }

                const reservedQuantity = reservedByVariantId.get(variantId) ?? 0;
                const availableQuantity = getAvailableQuantity(
                    variant.quantity,
                    reservedQuantity,
                );

                if (availableQuantity < requestItem.quantity) {
                    throw new Error(
                        `${variant.stockItem.name} มีไม่เพียงพอสำหรับเบิก (พร้อมเบิก: ${availableQuantity} ${variant.unit})`,
                    );
                }
            }

            return tx.stockRequest.create({
                data: {
                    requestedBy: userId,
                    note: data.note ?? null,
                    items: {
                        create: normalizedItems,
                    },
                },
                include: buildRequestInclude(),
            });
        },
        {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
    );
}

export async function issueRequest(
    requestId: number,
    adminId: number,
) {
    return prisma.$transaction(async (tx) => {
        const request = await tx.stockRequest.findUnique({
            where: { id: requestId },
            select: {
                status: true,
                requestedBy: true,
                items: {
                    select: {
                        itemId: true,
                        variantId: true,
                        quantity: true,
                    },
                },
            },
        });

        if (!request) {
            throw new Error("ไม่พบคำขอเบิก");
        }
        if (request.status !== "PENDING_ISSUE") {
            throw new Error("คำขอนี้ถูกดำเนินการแล้ว");
        }

        const defaultVariantsByItemId = await ensureDefaultVariantsByItemIds(
            tx,
            request.items.map((item) => item.itemId),
        );
        const requestedQtyByVariantId = new Map<
            number,
            { itemId: number; quantity: number }
        >();

        for (const requestItem of request.items) {
            const variantId =
                requestItem.variantId ?? defaultVariantsByItemId.get(requestItem.itemId)?.id;
            if (!variantId) {
                throw new Error("ไม่พบรายการย่อยของวัสดุ");
            }

            const existing = requestedQtyByVariantId.get(variantId);
            requestedQtyByVariantId.set(variantId, {
                itemId: requestItem.itemId,
                quantity: (existing?.quantity ?? 0) + requestItem.quantity,
            });
        }

        const variants = await tx.stockItemVariant.findMany({
            where: { id: { in: Array.from(requestedQtyByVariantId.keys()) } },
            select: {
                id: true,
                stockItemId: true,
                unit: true,
                quantity: true,
                stockItem: { select: { name: true } },
            },
        });
        const variantById = new Map(variants.map((variant) => [variant.id, variant]));

        for (const [variantId, requestItem] of requestedQtyByVariantId) {
            const variant = variantById.get(variantId);
            if (!variant) {
                throw new Error("ไม่พบรายการย่อยของวัสดุ");
            }
            if (variant.quantity < requestItem.quantity) {
                throw new Error(
                    `${variant.stockItem.name} มีไม่เพียงพอ (คงเหลือ: ${variant.quantity} ${variant.unit})`,
                );
            }
        }

        for (const [variantId, requestItem] of requestedQtyByVariantId) {
            const updatedVariant = await tx.stockItemVariant.updateMany({
                where: {
                    id: variantId,
                    quantity: { gte: requestItem.quantity },
                },
                data: { quantity: { decrement: requestItem.quantity } },
            });

            if (updatedVariant.count === 0) {
                const variant = await tx.stockItemVariant.findUnique({
                    where: { id: variantId },
                    select: {
                        unit: true,
                        quantity: true,
                        stockItem: { select: { name: true } },
                    },
                });
                if (!variant) {
                    throw new Error("ไม่พบรายการย่อยของวัสดุ");
                }
                throw new Error(
                    `${variant.stockItem.name} มีไม่เพียงพอ (คงเหลือ: ${variant.quantity} ${variant.unit})`,
                );
            }

            await tx.stockItem.update({
                where: { id: requestItem.itemId },
                data: { quantity: { decrement: requestItem.quantity } },
            });

            await tx.stockTransaction.create({
                data: {
                    itemId: requestItem.itemId,
                    variantId,
                    type: "OUT",
                    quantity: -requestItem.quantity,
                    note: `จ่ายตามคำขอ #${requestId}`,
                    performedBy: adminId,
                },
            });
        }

        return tx.stockRequest.update({
            where: { id: requestId },
            data: {
                status: "ISSUED",
                issuedById: adminId,
                issuedAt: new Date(),
                cancelReason: null,
                cancelledById: null,
                cancelledAt: null,
            },
        });
    });
}

export async function cancelRequest(
    requestId: number,
    actorId: number,
    reason?: string | null,
    options: CancelRequestOptions = { isAdmin: false },
) {
    const request = await prisma.stockRequest.findUnique({
        where: { id: requestId },
        select: { status: true, requestedBy: true },
    });

    if (!request) {
        throw new Error("ไม่พบคำขอเบิก");
    }
    if (request.status !== "PENDING_ISSUE") {
        throw new Error("คำขอนี้ถูกดำเนินการแล้ว");
    }
    if (!options.isAdmin && request.requestedBy !== actorId) {
        throw new Error("ไม่มีสิทธิ์ยกเลิกคำขอนี้");
    }

    return prisma.stockRequest.update({
        where: { id: requestId },
        data: {
            status: "CANCELLED",
            cancelReason: reason ?? null,
            cancelledById: actorId,
            cancelledAt: new Date(),
        },
    });
}
