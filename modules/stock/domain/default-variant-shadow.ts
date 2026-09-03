import { selectLegacyDefaultVariantId } from "./legacy-default-variant";

export type DefaultVariantShadowClassification =
    | "MATCH"
    | "MISSING_EXPLICIT"
    | "MISMATCH"
    | "CROSS_ITEM_DEFAULT";

export type DefaultVariantShadowInput = {
    itemId: number;
    legacyDefaultVariantId: number | null;
    explicitDefaultVariantId: number | null;
    explicitDefaultVariantStockItemId?: number | null;
};

export type DefaultVariantShadowComparison = DefaultVariantShadowInput & {
    classification: DefaultVariantShadowClassification;
};

type DefaultVariantShadowWarn = (
    message: string,
    context: DefaultVariantShadowComparison,
) => void;

export function isExplicitDefaultVariantReadEnabled(
    value: string | undefined =
        process.env.STOCK_EXPLICIT_DEFAULT_READ_ENABLED,
): boolean {
    const normalizedValue = value?.trim().toLowerCase();
    return normalizedValue === "true" || normalizedValue === "1";
}

export function resolveDefaultVariantId(input: {
    legacyDefaultVariantId: number | null;
    explicitDefaultVariantId: number | null;
    explicitDefaultIsUsable: boolean;
    explicitReadEnabled: boolean;
}): number | null {
    if (
        input.explicitReadEnabled
        && input.explicitDefaultIsUsable
        && input.explicitDefaultVariantId !== null
    ) {
        return input.explicitDefaultVariantId;
    }

    return input.legacyDefaultVariantId;
}

export function buildDefaultVariantShadowComparison(
    input: DefaultVariantShadowInput,
): DefaultVariantShadowComparison {
    let classification: DefaultVariantShadowClassification;

    if (
        input.explicitDefaultVariantId !== null
        && input.explicitDefaultVariantStockItemId !== undefined
        && input.explicitDefaultVariantStockItemId !== input.itemId
    ) {
        classification = "CROSS_ITEM_DEFAULT";
    } else if (
        input.explicitDefaultVariantId === input.legacyDefaultVariantId
    ) {
        classification = "MATCH";
    } else if (input.explicitDefaultVariantId === null) {
        classification = "MISSING_EXPLICIT";
    } else {
        classification = "MISMATCH";
    }

    return { ...input, classification };
}

export function reportDefaultVariantShadowComparison(
    comparison: DefaultVariantShadowComparison,
    warn: DefaultVariantShadowWarn =
        (message, context) => console.warn(message, context),
): void {
    if (comparison.classification === "MATCH") return;

    warn("Stock default variant shadow mismatch", comparison);
}

export function buildResolvedDefaultVariantIds(
    items: ReadonlyArray<{
        id: number;
        defaultVariantId: number | null;
        variants: ReadonlyArray<{ id: number; isActive: boolean }>;
    }>,
    warn: DefaultVariantShadowWarn =
        (message, context) => console.warn(message, context),
    explicitReadEnabled: boolean =
        isExplicitDefaultVariantReadEnabled(),
): Map<number, number> {
    const defaults = new Map<number, number>();

    for (const item of items) {
        const legacyDefaultVariantId =
            selectLegacyDefaultVariantId(item.variants);
        reportDefaultVariantShadowComparison(
            buildDefaultVariantShadowComparison({
                itemId: item.id,
                legacyDefaultVariantId,
                explicitDefaultVariantId: item.defaultVariantId,
                explicitDefaultVariantStockItemId: undefined,
            }),
            warn,
        );
        const resolvedDefaultVariantId = resolveDefaultVariantId({
            legacyDefaultVariantId,
            explicitDefaultVariantId: item.defaultVariantId,
            explicitDefaultIsUsable: item.defaultVariantId !== null
                && item.variants.some(
                    (variant) =>
                        variant.id === item.defaultVariantId
                        && variant.isActive,
                ),
            explicitReadEnabled,
        });
        if (resolvedDefaultVariantId !== null) {
            defaults.set(item.id, resolvedDefaultVariantId);
        }
    }

    return defaults;
}
