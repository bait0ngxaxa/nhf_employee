import { StockInvariantViolationError } from "./errors";

export type CanonicalDefaultVariant = {
    id: number;
    stockItemId: number;
    isActive: boolean;
};

export function resolveCanonicalDefaultVariantId(input: {
    itemId: number;
    defaultVariantId: number | null;
    defaultVariant: CanonicalDefaultVariant | null;
    activeVariantIds: readonly number[];
}): number | null {
    if (input.defaultVariantId === null) {
        if (input.activeVariantIds.length > 0) {
            throw new StockInvariantViolationError(
                `Stock default variant invariant violated: item ${input.itemId} has active variants but no canonical default`,
            );
        }

        return null;
    }

    const defaultVariant = input.defaultVariant;
    if (!defaultVariant || defaultVariant.id !== input.defaultVariantId) {
        throw new StockInvariantViolationError(
            `Stock default variant invariant violated: item ${input.itemId} references a missing variant`,
        );
    }
    if (defaultVariant.stockItemId !== input.itemId) {
        throw new StockInvariantViolationError(
            `Stock default variant invariant violated: item ${input.itemId} references a variant owned by another item`,
        );
    }
    if (!defaultVariant.isActive) {
        throw new StockInvariantViolationError(
            `Stock default variant invariant violated: item ${input.itemId} references an inactive variant`,
        );
    }
    if (!input.activeVariantIds.includes(defaultVariant.id)) {
        throw new StockInvariantViolationError(
            `Stock default variant invariant violated: item ${input.itemId} default is absent from its active variants`,
        );
    }

    return defaultVariant.id;
}
