import { StockRequestStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type {
    StockItemsFilter,
    StockRequestsFilter,
} from "@/lib/validations/stock";
import {
    buildItemInclude,
    buildRequestInclude,
    buildReservedQuantityMaps,
    ensureDefaultCategoryId,
    ensureItemVariantsExist,
    getAvailableQuantity,
} from "./shared";

export async function getCategories() {
    await ensureDefaultCategoryId();
    return prisma.stockCategory.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { items: true } } },
    });
}

export async function getItems(filters: StockItemsFilter) {
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

    const itemIds = items.map((item) => item.id);
    const pendingRequestItems =
        itemIds.length > 0
            ? await prisma.stockRequestItem.findMany({
                  where: {
                      itemId: { in: itemIds },
                      request: { status: StockRequestStatus.PENDING_ISSUE },
                  },
                  select: {
                      itemId: true,
                      variantId: true,
                      quantity: true,
                  },
              })
            : [];
    const defaultVariantIdByItemId = new Map(
        items
            .map((item) => [item.id, item.variants[0]?.id] as const)
            .filter((entry): entry is readonly [number, number] => entry[1] !== undefined),
    );
    const { reservedByItemId, reservedByVariantId } = buildReservedQuantityMaps(
        pendingRequestItems,
        defaultVariantIdByItemId,
    );

    return {
        items: items.map((item) => {
            const reservedQuantity = reservedByItemId.get(item.id) ?? 0;

            return {
                ...item,
                reservedQuantity,
                availableQuantity: getAvailableQuantity(item.quantity, reservedQuantity),
                variants: item.variants.map((variant) => {
                    const variantReservedQuantity =
                        reservedByVariantId.get(variant.id) ?? 0;

                    return {
                        ...variant,
                        reservedQuantity: variantReservedQuantity,
                        availableQuantity: getAvailableQuantity(
                            variant.quantity,
                            variantReservedQuantity,
                        ),
                    };
                }),
            };
        }),
        total,
        page,
        limit,
    };
}

export async function getItemById(id: number) {
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

export async function getRequests(
    filters: StockRequestsFilter,
    userId: number,
    isAdmin: boolean,
    scope: "mine" | "all" = "mine",
) {
    const { status, search, page, limit } = filters;
    const shouldShowAll = isAdmin && scope === "all";
    const trimmedSearch = search?.trim();
    const numericSearch = trimmedSearch ? Number(trimmedSearch) : Number.NaN;
    const searchFilters: Prisma.StockRequestWhereInput[] = [];

    if (trimmedSearch) {
        searchFilters.push(
            { projectCode: { contains: trimmedSearch } },
            { requester: { name: { contains: trimmedSearch } } },
            { requester: { email: { contains: trimmedSearch } } },
            { items: { some: { item: { name: { contains: trimmedSearch } } } } },
        );

        if (Number.isInteger(numericSearch) && numericSearch > 0) {
            searchFilters.push({ id: numericSearch });
        }
    }

    const where: Prisma.StockRequestWhereInput = {
        ...(status !== undefined && { status }),
        ...(!shouldShowAll && { requestedBy: userId }),
        ...(searchFilters.length > 0 && { OR: searchFilters }),
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
