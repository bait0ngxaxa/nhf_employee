import type {
    StockItem,
    StockItemVariant,
    StockRequestItemDetail,
} from "../context/types";

export interface StockVariantAttributeValueLike {
    attributeValue: {
        value: string;
        attribute: { name: string };
    };
}

export interface StockBrowseVariant {
    id: number;
    sku: string;
    unit: string;
    imageUrl?: string | null;
    availableQuantity: number;
    attributeValues?: StockVariantAttributeValueLike[];
}

export interface StockBrowseItem {
    id: number;
    name: string;
    imageUrl?: string | null;
    variants?: StockBrowseVariant[];
}

export type BrowseCartItem = {
    item: Pick<StockBrowseItem, "id" | "name" | "imageUrl">;
    variant: StockBrowseVariant;
    qty: number;
};

type VariantWithAvailableQuantity = Pick<StockItemVariant, "availableQuantity">;

export function getVariantAttributeSummary(
    attributeValues?: StockVariantAttributeValueLike[],
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
        attributeValues?: StockVariantAttributeValueLike[];
    } | null,
): string {
    if (!variant) {
        return itemName;
    }

    const attributeSummary = getVariantAttributeSummary(variant.attributeValues);
    if (!attributeSummary) {
        return itemName;
    }

    return `${itemName} • ${attributeSummary}`;
}

export function getPreferredVariant(item: StockBrowseItem): StockBrowseVariant | null {
    return item.variants?.[0] ?? null;
}

export function getItemAvailableQuantity(item: StockItem): number {
    return item.availableQuantity;
}

export function getVariantAvailableQuantity(variant: VariantWithAvailableQuantity): number {
    return variant.availableQuantity;
}

export function getBrowseImageUrl(
    item: StockBrowseItem,
    variant?: StockBrowseVariant | null,
): string | null {
    return variant?.imageUrl ?? item.imageUrl ?? null;
}

export function getBrowseCardImageUrl(item: StockBrowseItem): string | null {
    return item.imageUrl ?? getPreferredVariant(item)?.imageUrl ?? null;
}

export function hasSelectableVariants(item: StockBrowseItem): boolean {
    return (item.variants?.length ?? 0) > 1;
}

export function getSelectableVariantCount(item: StockBrowseItem): number {
    return item.variants?.length ?? 0;
}

export function getRequestItemDisplayName(item: StockRequestItemDetail): string {
    return getVariantDisplayName(item.item.name, item.variant);
}
