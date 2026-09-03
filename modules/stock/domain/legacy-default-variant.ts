export const LEGACY_DEFAULT_VARIANT_ORDER_BY = { id: "asc" } as const;

export function selectLegacyDefaultVariantId(
    variants: ReadonlyArray<{ id: number; isActive: boolean }>,
): number | null {
    return variants.reduce<number | null>((lowestId, variant) => {
        if (!variant.isActive) return lowestId;
        return lowestId === null || variant.id < lowestId
            ? variant.id
            : lowestId;
    }, null);
}
