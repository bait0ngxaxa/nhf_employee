import { StockRequestStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type {
    StockItemsFilter,
    StockRequestsFilter,
} from "../../schemas/stock";
import { buildResolvedDefaultVariantIds } from "../../domain/default-variant-shadow";
import { summarizeVariantInventory } from "../../domain/inventory-quantity-read";
import type { StockRequestWithDetails } from "../requests/request-creation";
import {
    buildItemInclude,
    buildRequestInclude,
    buildReservedQuantityMaps,
    getAvailableQuantity,
    assertPersistedVariantsForRead,
} from "../../infrastructure/persistence/shared";

export async function getCategories() {
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

    const items = await prisma.stockItem.findMany({
        where,
        include: buildItemInclude(),
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
    });
    await assertPersistedVariantsForRead(items);
    const total = await prisma.stockItem.count({ where });

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
    buildResolvedDefaultVariantIds(items);
    const { reservedByItemId, reservedByVariantId } = buildReservedQuantityMaps(
        pendingRequestItems,
    );

    return {
        items: items.map((item) => {
            const reservedQuantity = reservedByItemId.get(item.id) ?? 0;
            const inventory = summarizeVariantInventory(item.variants);

            return {
                ...item,
                ...inventory,
                reservedQuantity,
                availableQuantity: getAvailableQuantity(
                    inventory.quantity,
                    reservedQuantity,
                ),
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

export type StockVariantAvailability = {
    id: number;
    availableQuantity: number;
    isAvailable: boolean;
};

export async function getVariantAvailability(
    variantIds: readonly number[],
): Promise<StockVariantAvailability[]> {
    const uniqueVariantIds = Array.from(new Set(variantIds));
    if (uniqueVariantIds.length === 0) {
        return [];
    }

    const variants = await prisma.stockItemVariant.findMany({
        where: {
            id: { in: uniqueVariantIds },
            isActive: true,
            stockItem: { isActive: true },
        },
        select: {
            id: true,
            stockItemId: true,
            quantity: true,
        },
    });
    const itemIds = Array.from(new Set(variants.map((variant) => variant.stockItemId)));
    const pendingRequestItems = itemIds.length > 0
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
    const { reservedByVariantId } = buildReservedQuantityMaps(
        pendingRequestItems,
    );
    const variantById = new Map(
        variants.map((variant) => [variant.id, variant]),
    );

    return uniqueVariantIds.map((variantId) => {
        const variant = variantById.get(variantId);
        if (!variant) {
            return { id: variantId, availableQuantity: 0, isAvailable: false };
        }

        const availableQuantity = getAvailableQuantity(
            variant.quantity,
            reservedByVariantId.get(variant.id) ?? 0,
        );
        return {
            id: variant.id,
            availableQuantity,
            isAvailable: availableQuantity > 0,
        };
    });
}

export async function getItemById(id: number) {
    const item = await prisma.stockItem.findUnique({
        where: { id },
        include: buildItemInclude(),
    });
    if (item) {
        await assertPersistedVariantsForRead([item]);
        buildResolvedDefaultVariantIds([item]);
        return {
            ...item,
            ...summarizeVariantInventory(item.variants),
        };
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
            {
                requester: {
                    employee: {
                        is: {
                            OR: [
                                { firstName: { contains: trimmedSearch } },
                                { lastName: { contains: trimmedSearch } },
                                { nickname: { contains: trimmedSearch } },
                            ],
                        },
                    },
                },
            },
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

export async function getRequestById(
    id: number,
): Promise<StockRequestWithDetails | null> {
    return prisma.stockRequest.findUnique({
        where: { id },
        include: buildRequestInclude(),
    });
}
