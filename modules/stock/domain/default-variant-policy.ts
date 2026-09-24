export const DEFAULT_VARIANT_ORDER_BY = { id: "asc" } as const;

export function selectPreferredDefaultVariantId(
    variants: ReadonlyArray<{ id: number; isActive: boolean }>,
): number | null {
    return variants.reduce<number | null>((preferredId, variant) => {
        if (!variant.isActive) return preferredId;
        return preferredId === null || variant.id < preferredId
            ? variant.id
            : preferredId;
    }, null);
}
