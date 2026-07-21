import { StockRequestStatus, type Prisma } from "@prisma/client";

import type { CreateRequestInput } from "@/lib/validations/stock";
import { createStockCommandAudit } from "./command-audit";
import {
    enqueueLineNewStockRequest,
    notifyAdminsNewStockRequest,
} from "./notifications";
import {
    buildRequestInclude,
    buildReservedQuantityMaps,
    ensureDefaultVariantsByItemIds,
    getAvailableQuantity,
    normalizeRequestItems,
} from "./shared";
import type { StockCommandActor } from "./types";

export type StockRequestWithDetails = Prisma.StockRequestGetPayload<{
    include: ReturnType<typeof buildRequestInclude>;
}>;

export type StockRequestIdentity = {
    idempotencyKey: string;
    requestHash: string;
};

type RequestedVariant = {
    id: number;
    stockItemId: number;
    isActive: boolean;
    stockItem: { isActive: boolean };
};

type NormalizedRequestItem = {
    itemId: number;
    variantId: number;
    quantity: number;
};

type NormalizedRequestContext = {
    items: NormalizedRequestItem[];
    defaultVariantsByItemId: Map<number, { id: number }>;
};

type RequestedQuantity = {
    itemId: number;
    quantity: number;
};

type AvailableVariant = {
    id: number;
    quantity: number;
    unit: string;
    stockItem: { name: string };
};

type PersistRequestCommand = {
    data: CreateRequestInput;
    actor: StockCommandActor;
    identity: StockRequestIdentity;
    items: NormalizedRequestItem[];
};

function validateRequestedVariants(
    items: CreateRequestInput["items"],
    variants: RequestedVariant[],
): Map<number, number> {
    const variantById = new Map(variants.map((variant) => [variant.id, variant]));
    const itemIdByVariantId = new Map<number, number>();

    for (const item of items) {
        if (item.variantId === undefined) continue;

        const variant = variantById.get(item.variantId);
        if (!variant || !variant.isActive || !variant.stockItem.isActive) {
            throw new Error("ไม่พบรายการย่อยที่พร้อมใช้งาน");
        }
        if (item.itemId !== undefined && item.itemId !== variant.stockItemId) {
            throw new Error("รายการย่อยไม่ตรงกับวัสดุที่เลือก");
        }

        itemIdByVariantId.set(variant.id, variant.stockItemId);
    }

    return itemIdByVariantId;
}

async function normalizeRequestedItems(
    tx: Prisma.TransactionClient,
    data: CreateRequestInput,
): Promise<NormalizedRequestContext> {
    const variantIds = data.items
        .map((item) => item.variantId)
        .filter((variantId): variantId is number => variantId !== undefined);
    const itemIds = data.items
        .filter((item) => item.variantId === undefined)
        .map((item) => item.itemId)
        .filter((itemId): itemId is number => itemId !== undefined);
    const variants = variantIds.length
        ? await tx.stockItemVariant.findMany({
              where: { id: { in: variantIds } },
              select: {
                  id: true,
                  stockItemId: true,
                  isActive: true,
                  stockItem: { select: { isActive: true } },
              },
          })
        : [];
    const itemIdByVariantId = validateRequestedVariants(data.items, variants);
    const defaultVariantsByItemId = await ensureDefaultVariantsByItemIds(tx, itemIds);

    return {
        items: normalizeRequestItems(
            data,
            itemIdByVariantId,
            defaultVariantsByItemId,
        ),
        defaultVariantsByItemId,
    };
}

function buildRequestedQuantities(
    items: NormalizedRequestItem[],
): Map<number, RequestedQuantity> {
    const requestedByVariantId = new Map<number, RequestedQuantity>();

    for (const item of items) {
        const existing = requestedByVariantId.get(item.variantId);
        requestedByVariantId.set(item.variantId, {
            itemId: item.itemId,
            quantity: (existing?.quantity ?? 0) + item.quantity,
        });
    }

    return requestedByVariantId;
}

async function loadAvailability(
    tx: Prisma.TransactionClient,
    items: NormalizedRequestItem[],
    variantIds: number[],
): Promise<{
    variants: AvailableVariant[];
    pendingItems: Array<{
        itemId: number;
        variantId: number | null;
        quantity: number;
    }>;
}> {
    const [variants, pendingItems] = await Promise.all([
        tx.stockItemVariant.findMany({
            where: {
                id: { in: variantIds },
                isActive: true,
                stockItem: { isActive: true },
            },
            select: {
                id: true,
                quantity: true,
                unit: true,
                stockItem: { select: { name: true } },
            },
        }),
        tx.stockRequestItem.findMany({
            where: {
                itemId: { in: Array.from(new Set(items.map((item) => item.itemId))) },
                request: { status: StockRequestStatus.PENDING_ISSUE },
            },
            select: {
                itemId: true,
                variantId: true,
                quantity: true,
            },
        }),
    ]);

    return { variants, pendingItems };
}

function assertStockAvailable(
    context: NormalizedRequestContext,
    requestedByVariantId: Map<number, RequestedQuantity>,
    variants: AvailableVariant[],
    pendingItems: Array<{
        itemId: number;
        variantId: number | null;
        quantity: number;
    }>,
): void {
    const defaultVariantIdByItemId = new Map(
        Array.from(context.defaultVariantsByItemId.entries()).map(
            ([itemId, variant]) => [itemId, variant.id] as const,
        ),
    );
    const { reservedByVariantId } = buildReservedQuantityMaps(
        pendingItems,
        defaultVariantIdByItemId,
    );
    const variantById = new Map(variants.map((variant) => [variant.id, variant]));

    for (const [variantId, requested] of requestedByVariantId) {
        const variant = variantById.get(variantId);
        if (!variant) {
            throw new Error("กรุณาเลือกรายการวัสดุ");
        }

        const availableQuantity = getAvailableQuantity(
            variant.quantity,
            reservedByVariantId.get(variantId) ?? 0,
        );
        if (availableQuantity < requested.quantity) {
            throw new Error(
                `${variant.stockItem.name} มีไม่เพียงพอสำหรับเบิก (พร้อมเบิก: ${availableQuantity} ${variant.unit})`,
            );
        }
    }
}

async function persistRequest(
    tx: Prisma.TransactionClient,
    command: PersistRequestCommand,
): Promise<StockRequestWithDetails> {
    const { data, actor, identity, items } = command;
    const request = await tx.stockRequest.create({
        data: {
            requestedBy: actor.id,
            idempotencyKey: identity.idempotencyKey,
            requestHash: identity.requestHash,
            projectCode: data.projectCode,
            note: data.note ?? null,
            items: { create: items },
        },
        include: buildRequestInclude(),
    });

    await createStockCommandAudit(tx, "STOCK_REQUEST_CREATE", request.id, actor, {
        after: {
            itemCount: data.items.length,
            projectCode: data.projectCode,
        },
    });
    await notifyAdminsNewStockRequest(
        request.id,
        actor.name,
        request.projectCode,
        tx,
    );
    await enqueueLineNewStockRequest(request, tx);

    return request;
}

export async function createNewStockRequest(
    tx: Prisma.TransactionClient,
    data: CreateRequestInput,
    actor: StockCommandActor,
    identity: StockRequestIdentity,
): Promise<StockRequestWithDetails> {
    const context = await normalizeRequestedItems(tx, data);
    const requestedByVariantId = buildRequestedQuantities(context.items);
    const availability = await loadAvailability(
        tx,
        context.items,
        Array.from(requestedByVariantId.keys()),
    );
    assertStockAvailable(
        context,
        requestedByVariantId,
        availability.variants,
        availability.pendingItems,
    );

    return persistRequest(tx, {
        data,
        actor,
        identity,
        items: context.items,
    });
}
