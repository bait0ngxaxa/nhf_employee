import type { Prisma, StockTxType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
    deleteLocalUploadByUrl,
    isManagedUploadUrl,
} from "@/lib/uploads/local";
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

type ItemVariantSeed = {
    id: number;
    sku: string;
    unit: string;
    quantity: number;
    minStock: number;
    imageUrl: string | null;
    isActive: boolean;
};

type CancelRequestOptions = {
    isAdmin: boolean;
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

async function ensureDefaultVariant(
    tx: Prisma.TransactionClient,
    item: ItemVariantSeed,
): Promise<{ id: number }> {
    const existingVariant = await tx.stockItemVariant.findFirst({
        where: { stockItemId: item.id, isActive: true },
        orderBy: { id: "asc" },
        select: { id: true },
    });

    if (existingVariant) {
        return existingVariant;
    }

    return tx.stockItemVariant.create({
        data: {
            stockItemId: item.id,
            sku: item.sku,
            unit: item.unit,
            quantity: item.quantity,
            minStock: item.minStock,
            imageUrl: item.imageUrl,
            isActive: item.isActive,
        },
        select: { id: true },
    });
}

async function ensureDefaultVariantsByItemIds(
    tx: Prisma.TransactionClient,
    itemIds: number[],
): Promise<Map<number, { id: number }>> {
    const uniqueItemIds = Array.from(new Set(itemIds));
    if (uniqueItemIds.length === 0) {
        return new Map();
    }

    const items = await tx.stockItem.findMany({
        where: { id: { in: uniqueItemIds } },
        select: {
            id: true,
            sku: true,
            unit: true,
            quantity: true,
            minStock: true,
            imageUrl: true,
            isActive: true,
        },
    });

    const variants = new Map<number, { id: number }>();
    for (const item of items) {
        variants.set(item.id, await ensureDefaultVariant(tx, item));
    }

    return variants;
}

async function ensureItemVariantsExist(itemIds: number[]): Promise<void> {
    await prisma.$transaction(async (tx) => {
        await ensureDefaultVariantsByItemIds(tx, itemIds);
    });
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

function buildItemInclude() {
    return {
        category: { select: { id: true, name: true } },
        variants: {
            where: { isActive: true },
            include: {
                attributeValues: {
                    include: {
                        attributeValue: {
                            include: { attribute: { select: { id: true, name: true } } },
                        },
                    },
                },
            },
            orderBy: { id: "asc" as const },
        },
    };
}

async function getItems(filters: StockItemsFilter) {
    const { categoryId, search, activeOnly, page, limit } = filters;
    const where = {
        ...(categoryId !== undefined && { categoryId }),
        ...(activeOnly !== undefined && { isActive: activeOnly }),
        ...(search && {
            OR: [
                { name: { contains: search } },
                { sku: { contains: search } },
                { variants: { some: { sku: { contains: search } } } },
            ],
        }),
    };

    let items = await prisma.stockItem.findMany({
        where,
        include: buildItemInclude(),
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
    });
    const total = await prisma.stockItem.count({ where });

    const missingVariantItemIds = items
        .filter((item) => item.variants.length === 0)
        .map((item) => item.id);
    if (missingVariantItemIds.length > 0) {
        await ensureItemVariantsExist(missingVariantItemIds);
        items = await prisma.stockItem.findMany({
            where,
            include: buildItemInclude(),
            orderBy: { name: "asc" },
            skip: (page - 1) * limit,
            take: limit,
        });
    }

    return { items, total, page, limit };
}

async function getItemById(id: number) {
    let item = await prisma.stockItem.findUnique({
        where: { id },
        include: buildItemInclude(),
    });

    if (item && item.variants.length === 0) {
        await ensureItemVariantsExist([item.id]);
        item = await prisma.stockItem.findUnique({
            where: { id },
            include: buildItemInclude(),
        });
    }

    return item;
}

async function createVariantAttributes(
    tx: Prisma.TransactionClient,
    variantId: number,
    attributes: NonNullable<CreateItemInput["variants"]>[number]["attributes"],
): Promise<void> {
    for (const attribute of attributes) {
        const attributeRecord = await tx.stockAttribute.upsert({
            where: { name: attribute.name },
            update: {},
            create: { name: attribute.name },
            select: { id: true },
        });

        const attributeValue = await tx.stockAttributeValue.upsert({
            where: {
                attributeId_value: {
                    attributeId: attributeRecord.id,
                    value: attribute.value,
                },
            },
            update: {},
            create: {
                attributeId: attributeRecord.id,
                value: attribute.value,
            },
            select: { id: true },
        });

        await tx.stockVariantAttributeValue.create({
            data: {
                variantId,
                attributeValueId: attributeValue.id,
            },
        });
    }
}

function summarizeVariantInventory(
    variants: Array<{ quantity: number; minStock: number; unit: string }>,
    fallbackUnit: string,
): { quantity: number; minStock: number; unit: string } {
    return {
        quantity: variants.reduce((sum, variant) => sum + variant.quantity, 0),
        minStock: variants.reduce((sum, variant) => sum + variant.minStock, 0),
        unit: variants[0]?.unit ?? fallbackUnit,
    };
}

async function variantHasReferences(
    tx: Prisma.TransactionClient,
    variantId: number,
): Promise<boolean> {
    const [transaction, requestItem] = await Promise.all([
        tx.stockTransaction.findFirst({
            where: { variantId },
            select: { id: true },
        }),
        tx.stockRequestItem.findFirst({
            where: { variantId },
            select: { id: true },
        }),
    ]);

    return Boolean(transaction || requestItem);
}

async function cleanupUnusedUploadUrls(
    candidateUrls: Iterable<string | null | undefined>,
    retainedUrls: Iterable<string | null | undefined>,
): Promise<void> {
    const retained = new Set(
        Array.from(retainedUrls).filter((url): url is string => isManagedUploadUrl(url)),
    );
    const candidates = Array.from(
        new Set(
            Array.from(candidateUrls).filter(
                (url): url is string => isManagedUploadUrl(url) && !retained.has(url),
            ),
        ),
    );

    await Promise.allSettled(candidates.map((url) => deleteLocalUploadByUrl(url)));
}

async function createItem(data: CreateStockItemInput) {
    const categoryId = data.categoryId ?? (await ensureDefaultCategoryId());
    const sku = data.sku?.trim() ? data.sku.trim() : generateSku();
    const variants = data.variants ?? [];
    const totalQuantity =
        variants.length > 0
            ? variants.reduce((sum, variant) => sum + variant.quantity, 0)
            : (data.quantity ?? 1);
    const totalMinStock =
        variants.length > 0
            ? variants.reduce((sum, variant) => sum + variant.minStock, 0)
            : (data.minStock ?? 1);
    const fallbackUnit = variants[0]?.unit ?? data.unit ?? "ชิ้น";

    return prisma.$transaction(async (tx) => {
        const item = await tx.stockItem.create({
            data: {
                name: data.name,
                description: data.description ?? null,
                imageUrl: data.imageUrl ?? null,
                sku,
                unit: fallbackUnit,
                quantity: totalQuantity,
                minStock: totalMinStock,
                categoryId,
            },
            select: {
                id: true,
                sku: true,
                unit: true,
                quantity: true,
                minStock: true,
                imageUrl: true,
                isActive: true,
            },
        });

        if (variants.length === 0) {
            await ensureDefaultVariant(tx, item);
        } else {
            for (let index = 0; index < variants.length; index += 1) {
                const variant = variants[index];
                const variantRecord = await tx.stockItemVariant.create({
                    data: {
                        stockItemId: item.id,
                        sku: variant.sku?.trim() ? variant.sku.trim() : `${sku}-V${index + 1}`,
                        unit: variant.unit,
                        quantity: variant.quantity,
                        minStock: variant.minStock,
                        imageUrl: variant.imageUrl ?? item.imageUrl,
                        isActive: true,
                    },
                    select: { id: true },
                });

                await createVariantAttributes(
                    tx,
                    variantRecord.id,
                    variant.attributes,
                );
            }
        }

        return tx.stockItem.findUniqueOrThrow({
            where: { id: item.id },
            include: buildItemInclude(),
        });
    });
}

async function updateItem(id: number, data: UpdateItemInput) {
    const cleanupCandidates = new Set<string>();
    const retainedUploadUrls = new Set<string>();

    const updatedItem = await prisma.$transaction(async (tx) => {
        const { variants, ...itemData } = data;

        if (variants && variants.length > 0) {
            const item = await tx.stockItem.findUniqueOrThrow({
                where: { id },
                select: {
                    id: true,
                    sku: true,
                    unit: true,
                    quantity: true,
                    minStock: true,
                    imageUrl: true,
                    isActive: true,
                },
            });

            const existingVariants = await tx.stockItemVariant.findMany({
                where: { stockItemId: id },
                select: {
                    id: true,
                    sku: true,
                    imageUrl: true,
                    isActive: true,
                },
                orderBy: { id: "asc" },
            });

            if (existingVariants.length === 0) {
                await ensureDefaultVariant(tx, {
                    id: item.id,
                    sku: item.sku,
                    unit: item.unit,
                    quantity: item.quantity,
                    minStock: item.minStock,
                    imageUrl: item.imageUrl,
                    isActive: item.isActive,
                });
            }

            const syncedVariants = existingVariants.length
                ? existingVariants
                : await tx.stockItemVariant.findMany({
                      where: { stockItemId: id },
                  select: {
                          id: true,
                          sku: true,
                          imageUrl: true,
                          isActive: true,
                      },
                      orderBy: { id: "asc" },
                  });

            const existingVariantById = new Map(
                syncedVariants.map((variant) => [variant.id, variant]),
            );

            for (const variant of variants) {
                if (variant.id && !existingVariantById.has(variant.id)) {
                    throw new Error("พบรายการย่อยไม่ถูกต้อง");
                }
            }

            const inventorySummary = summarizeVariantInventory(variants, item.unit);
            const updatedItem = await tx.stockItem.update({
                where: { id },
                data: {
                    ...itemData,
                    unit: variants[0]?.unit ?? item.unit,
                    quantity: inventorySummary.quantity,
                    minStock: inventorySummary.minStock,
                },
                select: {
                    id: true,
                    sku: true,
                    imageUrl: true,
                },
            });

            if (item.imageUrl && item.imageUrl !== updatedItem.imageUrl) {
                cleanupCandidates.add(item.imageUrl);
            }
            if (updatedItem.imageUrl) {
                retainedUploadUrls.add(updatedItem.imageUrl);
            }

            const submittedIds = new Set(
                variants
                    .map((variant) => variant.id)
                    .filter((variantId): variantId is number => variantId !== undefined),
            );

            for (let index = 0; index < variants.length; index += 1) {
                const variant = variants[index];
                if (!variant.id) {
                    const nextVariantImageUrl = variant.imageUrl ?? updatedItem.imageUrl;
                    const createdVariant = await tx.stockItemVariant.create({
                        data: {
                            stockItemId: id,
                            sku:
                                variant.sku?.trim() ||
                                `${updatedItem.sku}-V${index + 1}`,
                            unit: variant.unit,
                            quantity: variant.quantity,
                            minStock: variant.minStock,
                            imageUrl: variant.imageUrl ?? updatedItem.imageUrl,
                            isActive: true,
                        },
                        select: { id: true },
                    });
                    await createVariantAttributes(
                        tx,
                        createdVariant.id,
                        variant.attributes,
                    );
                    if (nextVariantImageUrl) {
                        retainedUploadUrls.add(nextVariantImageUrl);
                    }
                    continue;
                }

                const existingVariant = existingVariantById.get(variant.id);
                if (!existingVariant) {
                    throw new Error("พบรายการย่อยไม่ถูกต้อง");
                }

                await tx.stockItemVariant.update({
                    where: { id: variant.id },
                    data: {
                        sku:
                            variant.sku?.trim() ||
                            existingVariant.sku ||
                            `${updatedItem.sku}-V${index + 1}`,
                        unit: variant.unit,
                        quantity: variant.quantity,
                        minStock: variant.minStock,
                        imageUrl:
                            variant.imageUrl ?? existingVariant.imageUrl ?? updatedItem.imageUrl,
                    },
                });

                const nextVariantImageUrl =
                    variant.imageUrl ?? existingVariant.imageUrl ?? updatedItem.imageUrl;

                if (existingVariant.imageUrl && existingVariant.imageUrl !== nextVariantImageUrl) {
                    cleanupCandidates.add(existingVariant.imageUrl);
                }
                if (nextVariantImageUrl) {
                    retainedUploadUrls.add(nextVariantImageUrl);
                }

                await tx.stockVariantAttributeValue.deleteMany({
                    where: { variantId: variant.id },
                });
                await createVariantAttributes(tx, variant.id, variant.attributes);
            }

            const removedVariants = syncedVariants.filter(
                (variant) => !submittedIds.has(variant.id),
            );

            for (const removedVariant of removedVariants) {
                const hasReferences = await variantHasReferences(tx, removedVariant.id);
                if (hasReferences) {
                    await tx.stockItemVariant.update({
                        where: { id: removedVariant.id },
                        data: { isActive: false },
                    });
                    continue;
                }

                if (removedVariant.imageUrl) {
                    cleanupCandidates.add(removedVariant.imageUrl);
                }

                await tx.stockVariantAttributeValue.deleteMany({
                    where: { variantId: removedVariant.id },
                });
                await tx.stockItemVariant.delete({
                    where: { id: removedVariant.id },
                });
            }

            return tx.stockItem.findUniqueOrThrow({
                where: { id },
                include: buildItemInclude(),
            });
        }

        const currentItem = await tx.stockItem.findUniqueOrThrow({
            where: { id },
            select: { imageUrl: true },
        });

        const updatedItem = await tx.stockItem.update({
            where: { id },
            data: itemData,
            select: {
                id: true,
                sku: true,
                unit: true,
                quantity: true,
                minStock: true,
                imageUrl: true,
                isActive: true,
            },
        });

        if (currentItem.imageUrl && currentItem.imageUrl !== updatedItem.imageUrl) {
            cleanupCandidates.add(currentItem.imageUrl);
        }
        if (updatedItem.imageUrl) {
            retainedUploadUrls.add(updatedItem.imageUrl);
        }

        const defaultVariant = await ensureDefaultVariant(tx, updatedItem);
        await tx.stockItemVariant.update({
            where: { id: defaultVariant.id },
            data: {
                ...(data.sku !== undefined && { sku: updatedItem.sku }),
                ...(data.unit !== undefined && { unit: updatedItem.unit }),
                ...(data.minStock !== undefined && { minStock: updatedItem.minStock }),
                ...(data.imageUrl !== undefined && { imageUrl: updatedItem.imageUrl }),
                ...(data.isActive !== undefined && { isActive: updatedItem.isActive }),
            },
        });

        return tx.stockItem.findUniqueOrThrow({
            where: { id },
            include: buildItemInclude(),
        });
    });

    await cleanupUnusedUploadUrls(cleanupCandidates, retainedUploadUrls);
    return updatedItem;
}

async function adjustStock(itemId: number, input: AdjustStockInput, userId: number) {
    return prisma.$transaction(async (tx) => {
        const item = await tx.stockItem.findUnique({
            where: { id: itemId },
            select: {
                id: true,
                sku: true,
                unit: true,
                quantity: true,
                minStock: true,
                imageUrl: true,
                isActive: true,
            },
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

        const defaultVariant = await ensureDefaultVariant(tx, item);
        await tx.stockItemVariant.update({
            where: { id: defaultVariant.id },
            data: {
                quantity: newQty,
                minStock: input.minStock,
            },
        });

        await tx.stockTransaction.create({
            data: {
                itemId,
                variantId: defaultVariant.id,
                type: input.type as StockTxType,
                quantity: input.quantity,
                note: null,
                performedBy: userId,
            },
        });

        return {
            itemId,
            variantId: defaultVariant.id,
            previousQty: item.quantity,
            newQty,
            previousMinStock: item.minStock,
            newMinStock: input.minStock,
        };
    });
}

function buildRequestInclude() {
    return {
        requester: { select: { id: true, name: true, email: true } },
        issuer: { select: { id: true, name: true } },
        canceller: { select: { id: true, name: true } },
        items: {
            include: {
                item: {
                    select: { id: true, name: true, sku: true, unit: true },
                },
                variant: {
                    select: {
                        id: true,
                        sku: true,
                        unit: true,
                        imageUrl: true,
                        attributeValues: {
                            include: {
                                attributeValue: {
                                    include: {
                                        attribute: { select: { id: true, name: true } },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    };
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
            include: buildRequestInclude(),
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
        }),
        prisma.stockRequest.count({ where }),
    ]);

    return { requests, total, page, limit };
}

async function createRequest(data: CreateRequestInput, userId: number) {
    return prisma.$transaction(async (tx) => {
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

        const request = await tx.stockRequest.create({
            data: {
                requestedBy: userId,
                note: data.note ?? null,
                items: {
                    create: data.items.map((item) => {
                        const itemId =
                            item.itemId ??
                            (item.variantId
                                ? itemIdByVariantId.get(item.variantId)
                                : undefined);
                        const variantId =
                            item.variantId ??
                            (itemId ? defaultVariantsByItemId.get(itemId)?.id : undefined);

                        if (!itemId) {
                            throw new Error("กรุณาเลือกรายการวัสดุ");
                        }

                        return {
                            itemId,
                            variantId,
                            quantity: item.quantity,
                        };
                    }),
                },
            },
            include: buildRequestInclude(),
        });

        return request;
    });
}

async function issueRequest(requestId: number, adminId: number) {
    return prisma.$transaction(async (tx) => {
        const request = await tx.stockRequest.findUnique({
            where: { id: requestId },
            select: {
                status: true,
                items: {
                    select: {
                        itemId: true,
                        variantId: true,
                        quantity: true,
                    },
                },
            },
        });

        if (!request) throw new Error("ไม่พบคำขอเบิก");
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
            if (!variantId) throw new Error("ไม่พบรายการย่อยของวัสดุ");

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
            if (!variant) throw new Error("ไม่พบรายการย่อยของวัสดุ");
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
                if (!variant) throw new Error("ไม่พบรายการย่อยของวัสดุ");
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

async function cancelRequest(
    requestId: number,
    actorId: number,
    reason?: string | null,
    options: CancelRequestOptions = { isAdmin: false },
) {
    const request = await prisma.stockRequest.findUnique({
        where: { id: requestId },
        select: { status: true, requestedBy: true },
    });

    if (!request) throw new Error("ไม่พบคำขอเบิก");
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
    issueRequest,
    cancelRequest,
};
