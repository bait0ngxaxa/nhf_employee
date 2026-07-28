export type InventoryQuantityShadowComparison = {
    itemId: number;
    itemSku: string;
    parentQuantity: number;
    variantQuantity: number;
    difference: number;
    classification: "MATCH" | "MISMATCH";
};

type InventoryQuantityShadowWarn = (
    message: string,
    context: InventoryQuantityShadowComparison,
) => void;

type InventoryQuantityReadItem = {
    id: number;
    sku: string;
    quantity: number;
    variants: ReadonlyArray<{ quantity: number }>;
};

export function isVariantInventoryReadEnabled(
    value: string | undefined =
        process.env.STOCK_VARIANT_INVENTORY_READ_ENABLED,
): boolean {
    const normalizedValue = value?.trim().toLowerCase();
    return normalizedValue === "true" || normalizedValue === "1";
}

export function resolveInventoryQuantity(input: {
    legacyQuantity: number;
    variantQuantity: number;
    variantReadEnabled: boolean;
}): number {
    return input.variantReadEnabled
        ? input.variantQuantity
        : input.legacyQuantity;
}

export function buildInventoryQuantityShadowComparison(input: {
    itemId: number;
    itemSku: string;
    parentQuantity: number;
    variantQuantity: number;
}): InventoryQuantityShadowComparison {
    const difference = input.parentQuantity - input.variantQuantity;

    return {
        ...input,
        difference,
        classification: difference === 0 ? "MATCH" : "MISMATCH",
    };
}

export function reportInventoryQuantityShadowComparison(
    comparison: InventoryQuantityShadowComparison,
    warn: InventoryQuantityShadowWarn =
        (message, context) => console.warn(message, context),
): void {
    if (comparison.classification === "MATCH") {
        return;
    }

    warn("Stock inventory quantity shadow mismatch", comparison);
}

export function resolveStockItemReadQuantity(
    item: InventoryQuantityReadItem,
    options: {
        legacyQuantity?: number;
        variantReadEnabled?: boolean;
        warn?: InventoryQuantityShadowWarn;
    } = {},
): number {
    const variantQuantity = item.variants.reduce(
        (sum, variant) => sum + variant.quantity,
        0,
    );
    reportInventoryQuantityShadowComparison(
        buildInventoryQuantityShadowComparison({
            itemId: item.id,
            itemSku: item.sku,
            parentQuantity: item.quantity,
            variantQuantity,
        }),
        options.warn,
    );

    return resolveInventoryQuantity({
        legacyQuantity: options.legacyQuantity ?? item.quantity,
        variantQuantity,
        variantReadEnabled:
            options.variantReadEnabled ?? isVariantInventoryReadEnabled(),
    });
}
