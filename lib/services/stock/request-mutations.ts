import { StockRequestStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
    hasPrismaErrorCode,
    runSerializableTransaction,
} from "@/lib/db/transaction";
import { createStockCommandAudit } from "./command-audit";
import {
    createNewStockRequest,
    type StockRequestWithDetails,
} from "./request-creation";
import {
    assertMatchingRequestHash,
    createStockRequestHash,
} from "./request-idempotency";
import {
    notifyAdminsStockRequestCancelledByRequester,
    notifyStockRequestResult,
    persistLowStockNotifications,
} from "./notifications";
import type {
    CreateRequestInput,
} from "@/lib/validations/stock";
import {
    buildRequestInclude,
    ensureDefaultVariantsByItemIds,
} from "./shared";
import type {
    CancelRequestOptions,
    IssueRequestResult,
    LowStockAlertCandidate,
    StockCommandActor,
} from "./types";

export type CreateStockRequestResult = {
    request: StockRequestWithDetails;
    replayed: boolean;
};

type CreateRequestOptions = {
    idempotencyKey: string;
};

function buildLowStockAlerts(
    items: Array<{
        id: number;
        name: string;
        sku: string;
        unit: string;
        quantity: number;
        minStock: number;
    }>,
    decrementedByItemId: Map<number, number>,
): LowStockAlertCandidate[] {
    return items.flatMap((item) => {
        const decrementedQuantity = decrementedByItemId.get(item.id) ?? 0;
        const nextQuantity = item.quantity - decrementedQuantity;

        if (
            decrementedQuantity <= 0 ||
            item.quantity <= item.minStock ||
            nextQuantity > item.minStock
        ) {
            return [];
        }

        return [
            {
                itemId: item.id,
                name: item.name,
                sku: item.sku,
                quantity: nextQuantity,
                minStock: item.minStock,
                unit: item.unit,
            },
        ];
    });
}

export async function createRequest(
    data: CreateRequestInput,
    actor: StockCommandActor,
    options: CreateRequestOptions,
): Promise<CreateStockRequestResult> {
    const requestHash = createStockRequestHash(data);
    const idempotencyWhere = {
        requestedBy_idempotencyKey: {
            requestedBy: actor.id,
            idempotencyKey: options.idempotencyKey,
        },
    };

    try {
        return await runSerializableTransaction(async (tx) => {
            const existingRequest = await tx.stockRequest.findUnique({
                where: idempotencyWhere,
                include: buildRequestInclude(),
            });
            if (existingRequest) {
                return {
                    request: assertMatchingRequestHash(existingRequest, requestHash),
                    replayed: true,
                };
            }

            const request = await createNewStockRequest(tx, data, actor, {
                idempotencyKey: options.idempotencyKey,
                requestHash,
            });
            return { request, replayed: false };
        });
    } catch (error) {
        if (!hasPrismaErrorCode(error, "P2002")) {
            throw error;
        }

        const existingRequest = await prisma.stockRequest.findUnique({
            where: idempotencyWhere,
            include: buildRequestInclude(),
        });
        if (!existingRequest) {
            throw error;
        }

        return {
            request: assertMatchingRequestHash(existingRequest, requestHash),
            replayed: true,
        };
    }
}

export async function issueRequest(
    requestId: number,
    actor: StockCommandActor,
): Promise<IssueRequestResult<{ id: number; requestedBy: number }>> {
    return prisma.$transaction(async (tx) => {
        const issuedAt = new Date();
        const claimedRequest = await tx.stockRequest.updateMany({
            where: {
                id: requestId,
                status: StockRequestStatus.PENDING_ISSUE,
            },
            data: {
                status: StockRequestStatus.ISSUED,
                issuedById: actor.id,
                issuedAt,
                cancelReason: null,
                cancelledById: null,
                cancelledAt: null,
            },
        });

        if (claimedRequest.count === 0) {
            const existingRequest = await tx.stockRequest.findUnique({
                where: { id: requestId },
                select: { status: true },
            });
            if (!existingRequest) {
                throw new Error("ไม่พบคำขอเบิก");
            }
            throw new Error("คำขอนี้ถูกดำเนินการแล้ว");
        }

        const request = await tx.stockRequest.findUnique({
            where: { id: requestId },
            select: {
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

        const defaultVariantsByItemId = await ensureDefaultVariantsByItemIds(
            tx,
            request.items.map((item) => item.itemId),
        );
        const requestedQtyByVariantId = new Map<
            number,
            { itemId: number; quantity: number }
        >();
        const requestedQtyByItemId = new Map<number, number>();

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
            requestedQtyByItemId.set(
                requestItem.itemId,
                (requestedQtyByItemId.get(requestItem.itemId) ?? 0) + requestItem.quantity,
            );
        }

        const items = await tx.stockItem.findMany({
            where: { id: { in: Array.from(requestedQtyByItemId.keys()) } },
            select: {
                id: true,
                name: true,
                sku: true,
                unit: true,
                quantity: true,
                minStock: true,
            },
        });
        const lowStockAlerts = buildLowStockAlerts(items, requestedQtyByItemId);

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
                    performedBy: actor.id,
                },
            });
        }

        await createStockCommandAudit(
            tx,
            "STOCK_REQUEST_ISSUE",
            requestId,
            actor,
        );
        await notifyStockRequestResult(
            requestId,
            request.requestedBy,
            true,
            undefined,
            tx,
        );
        await persistLowStockNotifications(lowStockAlerts, tx);

        return {
            request: {
                id: requestId,
                requestedBy: request.requestedBy,
            },
            lowStockAlerts,
        };
    });
}

export async function cancelRequest(
    requestId: number,
    actor: StockCommandActor,
    reason?: string | null,
    options: CancelRequestOptions = { isAdmin: false },
): Promise<Prisma.StockRequestGetPayload<Record<string, never>>> {
    return prisma.$transaction(async (tx) => {
        const request = await tx.stockRequest.findUnique({
            where: { id: requestId },
            select: { status: true, requestedBy: true },
        });

        if (!request) {
            throw new Error("ไม่พบคำขอเบิก");
        }
        if (request.status !== "PENDING_ISSUE") {
            throw new Error("คำขอนี้ถูกดำเนินการแล้ว");
        }
        if (!options.isAdmin && request.requestedBy !== actor.id) {
            throw new Error("ไม่มีสิทธิ์ยกเลิกคำขอนี้");
        }

        const cancelledRequest = await tx.stockRequest.updateMany({
            where: {
                id: requestId,
                status: StockRequestStatus.PENDING_ISSUE,
            },
            data: {
                status: StockRequestStatus.CANCELLED,
                cancelReason: reason ?? null,
                cancelledById: actor.id,
                cancelledAt: new Date(),
            },
        });

        if (cancelledRequest.count === 0) {
            const existingRequest = await tx.stockRequest.findUnique({
                where: { id: requestId },
                select: { id: true },
            });
            if (!existingRequest) {
                throw new Error("ไม่พบคำขอเบิก");
            }
            throw new Error("คำขอนี้ถูกดำเนินการแล้ว");
        }

        const updated = await tx.stockRequest.findUniqueOrThrow({
            where: { id: requestId },
        });
        await createStockCommandAudit(
            tx,
            "STOCK_REQUEST_CANCEL",
            requestId,
            actor,
            { metadata: { reason: reason ?? null } },
        );
        await notifyStockRequestResult(
            requestId,
            updated.requestedBy,
            false,
            reason,
            tx,
        );
        if (!options.isAdmin) {
            await notifyAdminsStockRequestCancelledByRequester(
                requestId,
                actor.name,
                tx,
            );
        }

        return updated;
    });
}
