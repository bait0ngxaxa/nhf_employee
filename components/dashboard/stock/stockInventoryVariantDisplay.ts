import type {
    StockItem,
    StockItemVariant,
    StockItemVariantAttributeValue,
} from "../context/stock/types";

function getAttributeSummary(
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

export function getVariantLabel(variant: StockItemVariant): string {
    const summary = getAttributeSummary(variant.attributeValues);
    return summary || `SKU ย่อย: ${variant.sku}`;
}

export function getVariantLabelFromAttributes(
    sku: string,
    attributes: Array<{ name: string; value: string }>,
): string {
    if (attributes.length === 0) {
        return `SKU ย่อย: ${sku}`;
    }

    return attributes
        .map((attribute) => `${attribute.name}: ${attribute.value}`)
        .join(" • ");
}

export function getItemInventoryMetrics(item: StockItem): {
    quantity: number;
    minStock: number;
    unit: string;
    isLowStock: boolean;
} {
    const variants = item.variants ?? [];
    if (variants.length === 0) {
        return {
            quantity: item.quantity,
            minStock: item.minStock,
            unit: item.unit,
            isLowStock: item.quantity <= item.minStock,
        };
    }

    const quantity = variants.reduce((sum, variant) => sum + variant.quantity, 0);
    const minStock = variants.reduce((sum, variant) => sum + variant.minStock, 0);
    const units = Array.from(new Set(variants.map((variant) => variant.unit.trim())));
    const unit = units.length === 1 ? units[0] ?? item.unit : item.unit;

    return {
        quantity,
        minStock,
        unit,
        isLowStock: quantity <= minStock,
    };
}
