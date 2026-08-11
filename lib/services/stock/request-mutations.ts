import {
    StockReferenceType,
    StockRequestStatus,
    type Prisma,
} from "@prisma/client";
import { defineAuditDetails } from "@/lib/audit-log/contracts";
import { prisma } from "@/lib/db/prisma";
import { assertActiveWorkforceInTransaction } from "@/lib/auth/workforce-transaction";
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
    buildVariantLabel,
    enqueueStockRequestResultEmail,
    notifyAdminsStockRequestCancelledByRequester,
    notifyStockRequestResult,
    persistLowStockNotifications,
} from "./notifications";
import {
    buildStockRequestResultEmailPayload,
    stockRequestResultEmailSelect,
} from "./notification-payloads";
import type {
    CreateRequestInput,
} from "@/lib/validations/stock";
import {
    buildRequestInclude,
} from "./shared";
import { lockStockInventoryRows } from "./locks";
import type {
    CancelRequestOptions,
    IssueRequestResult,
    LowStockAlertCandidate,
    StockCommandActor,
} from "./types";
import { getEmployeeBackedUserDisplayName } from "@/lib/helpers/employee-helpers";

export type CreateStockRequestResult = {
    request: StockRequestWithDetails;
    replayed: boolean;
};

type CreateRequestOptions = {
    idempotencyKey: string;
};

function buildVariantLowStockAlerts(
    variants: Array<{
        id: number;
        stockItemId: number;
        sku: string;
        unit: string;
        quantity: number;
        minStock: number;
        stockItem: { name: string };
        attributeValues: Array<{
            attributeValue: {
                value: string;
                attribute: { name: string };
            };
        }>;
    }>,
    decrementedByVariantId: Map<number, { quantity: number }>,
): LowStockAlertCandidate[] {
    return variants.flatMap((variant) => {
        const decrementedQuantity =
            decrementedByVariantId.get(variant.id)?.quantity ?? 0;
        const nextQuantity = variant.quantity - decrementedQuantity;

        if (
            decrementedQuantity <= 0 ||
            variant.quantity <= variant.minStock ||
            nextQuantity > variant.minStock
        ) {
            return [];
        }

        return [{
            itemId: variant.stockItemId,
            variantId: variant.id,
            itemName: variant.stockItem.name,
            variantSku: variant.sku,
            variantLabel: buildVariantLabel(variant.attributeValues) ?? variant.sku,
            quantity: nextQuantity,
            minStock: variant.minStock,
            unit: variant.unit,
        }];
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
            await assertActiveWorkforceInTransaction(tx, actor.id);

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
    return runSerializableTransaction(async (tx) => {
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
            select: stockRequestResultEmailSelect,
        });

        if (!request) {
            throw new Error("ไม่พบคำขอเบิก");
        }

        const validatedRequestItems = request.items.map((requestItem) => {
            const { variantId } = requestItem;
            if (variantId === null) {
                throw new Error(
                    "คำขอรอจ่ายมีรายการย่อยที่ยังไม่ได้ระบุ กรุณาสร้างคำขอใหม่",
                );
            }

            return { ...requestItem, variantId };
        });
        await lockStockInventoryRows(
            tx,
            validatedRequestItems.map((item) => item.itemId),
        );
        const requestedQtyByVariantId = new Map<
            number,
            { itemId: number; quantity: number }
        >();
        const requestedQtyByItemId = new Map<number, number>();

        for (const requestItem of validatedRequestItems) {
            const existing = requestedQtyByVariantId.get(requestItem.variantId);
            requestedQtyByVariantId.set(requestItem.variantId, {
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
                isActive: true,
            },
        });
        const variants = await tx.stockItemVariant.findMany({
            where: { id: { in: Array.from(requestedQtyByVariantId.keys()) } },
            select: {
                id: true,
                stockItemId: true,
                sku: true,
                unit: true,
                quantity: true,
                minStock: true,
                isActive: true,
                stockItem: { select: { name: true, sku: true, isActive: true } },
                attributeValues: {
                    select: {
                        attributeValue: {
                            select: {
                                value: true,
                                attribute: { select: { name: true } },
                            },
                        },
                    },
                },
            },
        });
        const lowStockAlerts =
            buildVariantLowStockAlerts(variants, requestedQtyByVariantId);
        const itemById = new Map(items.map((item) => [item.id, item]));
        const variantById = new Map(variants.map((variant) => [variant.id, variant]));
        const requestedVariantEntries = Array.from(
            requestedQtyByVariantId.entries(),
        ).sort(([leftVariantId], [rightVariantId]) => leftVariantId - rightVariantId);

        for (const [variantId, requestItem] of requestedVariantEntries) {
            const variant = variantById.get(variantId);
            const item = itemById.get(requestItem.itemId);
            if (
                !variant ||
                !item ||
                variant.stockItemId !== requestItem.itemId ||
                item.isActive === false ||
                variant.isActive === false ||
                variant.stockItem.isActive === false
            ) {
                throw new Error(
                    "ไม่สามารถจ่ายคำขอที่อ้างถึงวัสดุหรือรายการย่อยที่ปิดใช้งานแล้ว",
                );
            }
        }

        for (const [variantId, requestItem] of requestedVariantEntries) {
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

        for (const [variantId, requestItem] of requestedVariantEntries) {
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
        }

        const transactionIds: number[] = [];
        for (const requestItem of validatedRequestItems) {
            const transaction = await tx.stockTransaction.create({
                data: {
                    itemId: requestItem.itemId,
                    variantId: requestItem.variantId,
                    type: "OUT",
                    quantity: -requestItem.quantity,
                    note: `จ่ายตามคำขอ #${requestId}`,
                    performedBy: actor.id,
                    stockRequestId: requestId,
                    stockRequestItemId: requestItem.id,
                    referenceType: StockReferenceType.STOCK_REQUEST,
                    referenceId: String(requestId),
                },
                select: { id: true },
            });
            transactionIds.push(transaction.id);
        }

        await createStockCommandAudit(
            tx,
            "STOCK_REQUEST_ISSUE",
            requestId,
            actor,
            defineAuditDetails("STOCK_REQUEST_ISSUE", {
                before: { status: StockRequestStatus.PENDING_ISSUE },
                after: { status: StockRequestStatus.ISSUED },
                metadata: {
                    stockRequestId: requestId,
                    projectCode: request.projectCode,
                    variantIds: requestedVariantEntries.map(([variantId]) => variantId),
                    transactionIds,
                    lines: requestedVariantEntries.map(
                        ([variantId, requestItem]) => {
                            const variant = variantById.get(variantId);

                            return {
                                itemId: requestItem.itemId,
                                itemName: variant?.stockItem.name
                                    ?? "ไม่ทราบชื่อวัสดุ",
                                sku: variant?.stockItem.sku ?? variant?.sku
                                    ?? "ไม่ทราบรหัส",
                                variantId,
                                ...(variant
                                    ? {
                                          variantLabel:
                                              buildVariantLabel(variant.attributeValues)
                                              ?? variant.sku,
                                          unit: variant.unit,
                                      }
                                    : { unit: "" }),
                                quantity: requestItem.quantity,
                                variantQuantityBefore: variant?.quantity,
                                variantQuantityAfter:
                                    variant === undefined
                                        ? undefined
                                        : variant.quantity - requestItem.quantity,
                            };
                        },
                    ),
                },
            }),
        );
        await notifyStockRequestResult(
            requestId,
            request.requestedBy,
            true,
            null,
            tx,
        );
        await persistLowStockNotifications(lowStockAlerts, tx);
        await enqueueStockRequestResultEmail(
            buildStockRequestResultEmailPayload(
                request,
                "ISSUED",
                null,
                issuedAt,
            ),
            tx,
        );

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
    return runSerializableTransaction(async (tx) => {
        if (!options.isAdmin) {
            await assertActiveWorkforceInTransaction(tx, actor.id);
        }

        const request = await tx.stockRequest.findUnique({
            where: { id: requestId },
            select: stockRequestResultEmailSelect,
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

        const cancelledAt = new Date();
        const cancelledRequest = await tx.stockRequest.updateMany({
            where: {
                id: requestId,
                status: StockRequestStatus.PENDING_ISSUE,
            },
            data: {
                status: StockRequestStatus.CANCELLED,
                cancelReason: reason ?? null,
                cancelledById: actor.id,
                cancelledAt,
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
            defineAuditDetails("STOCK_REQUEST_CANCEL", {
                before: { status: request.status },
                after: { status: StockRequestStatus.CANCELLED },
                metadata: {
                    stockRequestId: requestId,
                    projectCode: request.projectCode,
                    reason: reason ?? null,
                },
            }),
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
                getEmployeeBackedUserDisplayName(request.requester),
                tx,
            );
        } else {
            await enqueueStockRequestResultEmail(
                buildStockRequestResultEmailPayload(
                    request,
                    "CANCELLED",
                    reason ?? null,
                    cancelledAt,
                ),
                tx,
            );
        }

        return updated;
    });
}
