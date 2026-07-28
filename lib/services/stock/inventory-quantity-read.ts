export type VariantInventorySummary = {
    quantity: number;
    minStock: number;
};

export function summarizeVariantInventory(
    variants: ReadonlyArray<{ quantity: number; minStock: number }>,
): VariantInventorySummary {
    return variants.reduce<VariantInventorySummary>(
        (summary, variant) => ({
            quantity: summary.quantity + variant.quantity,
            minStock: summary.minStock + variant.minStock,
        }),
        { quantity: 0, minStock: 0 },
    );
}

export function withVariantInventorySummary<
    T extends {
        quantity: number;
        minStock: number;
        variants: ReadonlyArray<{ quantity: number; minStock: number }>;
    },
>(item: T): Omit<T, "quantity" | "minStock"> & VariantInventorySummary {
    return {
        ...item,
        ...summarizeVariantInventory(item.variants),
    };
}
