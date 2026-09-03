import { getEmployeeBackedUserDisplayName } from "@/lib/helpers/employee-helpers";
import type {
    LiffStockCatalogItem,
    LiffStockCatalogResponse,
    LiffStockCategory,
    LiffStockRequestDetail,
    LiffStockRequestsResponse,
    LiffStockRequestSummary,
    LiffStockViewerRole,
} from "@/lib/types/stock-liff";

import { getStockRequestActions } from "../domain/action-availability";
import { buildVariantLabel } from "../infrastructure/notifications/notification-payloads";
import type {
    getItems,
    getRequests,
    getRequestById,
} from "../application/queries/queries";

type StockCatalogSource = Awaited<ReturnType<typeof getItems>>;
type StockRequestListSource = Awaited<ReturnType<typeof getRequests>>;
type StockRequestSource = NonNullable<
    Awaited<ReturnType<typeof getRequestById>>
>;

function toIsoString(value: Date | null): string | null {
    return value?.toISOString() ?? null;
}

export function toLiffStockCatalogItem(
    item: StockCatalogSource["items"][number],
): LiffStockCatalogItem {
    return {
        id: item.id,
        name: item.name,
        description: item.description,
        imageUrl: item.imageUrl,
        sku: item.sku,
        unit: item.unit,
        availableQuantity: item.availableQuantity,
        category: {
            id: item.category.id,
            name: item.category.name,
        },
        variants: item.variants.map((variant) => ({
            id: variant.id,
            sku: variant.sku,
            unit: variant.unit,
            imageUrl: variant.imageUrl,
            availableQuantity: variant.availableQuantity,
            attributeValues: variant.attributeValues.map((attributeValue) => ({
                attributeValue: {
                    value: attributeValue.attributeValue.value,
                    attribute: {
                        name: attributeValue.attributeValue.attribute.name,
                    },
                },
            })),
        })),
    };
}

export function toLiffStockCatalogResponse(
    source: StockCatalogSource,
): LiffStockCatalogResponse {
    return {
        items: source.items.map(toLiffStockCatalogItem),
        total: source.total,
        page: source.page,
        limit: source.limit,
        totalPages: Math.ceil(source.total / source.limit),
    };
}

export function toLiffStockCategory(category: {
    id: number;
    name: string;
}): LiffStockCategory {
    return { id: category.id, name: category.name };
}

export function toLiffStockRequestSummary(
    request: StockRequestSource,
    viewerRole: LiffStockViewerRole,
): LiffStockRequestSummary {
    return {
        id: request.id,
        projectCode: request.projectCode,
        status: request.status,
        note: request.note,
        cancelReason: request.cancelReason,
        issuedAt: toIsoString(request.issuedAt),
        cancelledAt: toIsoString(request.cancelledAt),
        createdAt: request.createdAt.toISOString(),
        ...(viewerRole === "PROCESSOR"
            ? {
                  requester: {
                      name: getEmployeeBackedUserDisplayName(request.requester),
                  },
              }
            : {}),
        items: request.items.map((requestItem) => {
            const variant = requestItem.variant;
            return {
                itemName: requestItem.item.name,
                itemSku: requestItem.item.sku,
                variantSku: variant?.sku ?? null,
                variantLabel: variant
                    ? buildVariantLabel(variant.attributeValues) ?? null
                    : null,
                unit: variant?.unit ?? requestItem.item.unit,
                quantity: requestItem.quantity,
                imageUrl: variant?.imageUrl ?? null,
                currentQuantity: variant?.quantity ?? null,
                isAvailableForIssue: Boolean(
                    requestItem.item.isActive
                    && variant?.isActive
                    && variant.quantity >= requestItem.quantity,
                ),
            };
        }),
        availableActions: getStockRequestActions(request.status, viewerRole),
    };
}

export function toLiffStockRequestsResponse(
    source: StockRequestListSource,
    viewerRole: LiffStockViewerRole,
): LiffStockRequestsResponse {
    return {
        requests: source.requests.map((request) =>
            toLiffStockRequestSummary(request, viewerRole),
        ),
        total: source.total,
        page: source.page,
        limit: source.limit,
        totalPages: Math.ceil(source.total / source.limit),
    };
}

export function toLiffStockRequestDetail(
    request: StockRequestSource,
    viewerRole: LiffStockViewerRole,
): LiffStockRequestDetail {
    return {
        ...toLiffStockRequestSummary(request, viewerRole),
        viewerRole,
    };
}
