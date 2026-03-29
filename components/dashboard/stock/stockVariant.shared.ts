import type {
    StockItem,
    StockItemVariant,
    StockItemVariantAttributeValue,
    StockRequestItemDetail,
} from "../context/stock/types";

export type BrowseCartItem = {
    item: StockItem;
    variant: StockItemVariant;
    qty: number;
};

export function getVariantAttributeSummary(
    attributeValues?: StockItemVariantAttributeValue[],
): string {
    if (!attributeValues || attributeValues.length === 0) {
        return "";
    }

    return attributeValues
        .map(
            (attributeValue) =>
                `${attributeValue.attributeValue.attribute.name}: ${attributeValue.attributeValue.value}`,
        )
        .join(" • ");
}

export function getVariantDisplayName(
    itemName: string,
    variant?: {
        sku: string;
        attributeValues?: StockItemVariantAttributeValue[];
    } | null,
): string {
    if (!variant) {
        return itemName;
    }

    const attributeSummary = getVariantAttributeSummary(variant.attributeValues);
    if (!attributeSummary) {
        return `${itemName} • ${variant.sku}`;
    }

    return `${itemName} • ${attributeSummary}`;
}

export function getPreferredVariant(item: StockItem): StockItemVariant | null {
    return item.variants?.[0] ?? null;
}

export function getItemAvailableQuantity(item: StockItem): number {
    return item.availableQuantity;
}

export function getVariantAvailableQuantity(variant: StockItemVariant): number {
    return variant.availableQuantity;
}

export function getBrowseImageUrl(item: StockItem, variant?: StockItemVariant | null): string | null {
    return variant?.imageUrl ?? item.imageUrl ?? null;
}

export function getBrowseCardImageUrl(item: StockItem): string | null {
    return item.imageUrl ?? getPreferredVariant(item)?.imageUrl ?? null;
}

export function hasSelectableVariants(item: StockItem): boolean {
    return (item.variants?.length ?? 0) > 1;
}

export function getSelectableVariantCount(item: StockItem): number {
    return item.variants?.length ?? 0;
}

export function getRequestItemDisplayName(item: StockRequestItemDetail): string {
    return getVariantDisplayName(item.item.name, item.variant);
}
