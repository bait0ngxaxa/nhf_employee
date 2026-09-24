import { StockInvariantViolationError } from "./errors";

export type CanonicalDefaultVariant = {
    id: number;
    stockItemId: number;
    isActive: boolean;
};

export function resolveCanonicalDefaultVariantIdFromActiveVariantIds(input: {
    itemId: number;
    defaultVariantId: number | null;
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

    if (!input.activeVariantIds.includes(input.defaultVariantId)) {
        throw new StockInvariantViolationError(
            `Stock default variant invariant violated: item ${input.itemId} default is not an active variant of that item`,
        );
    }

    return input.defaultVariantId;
}

export function resolveCanonicalDefaultVariantId(input: {
    itemId: number;
    defaultVariantId: number | null;
    defaultVariant: CanonicalDefaultVariant | null;
    activeVariantIds: readonly number[];
}): number | null {
    if (input.defaultVariantId === null) {
        return resolveCanonicalDefaultVariantIdFromActiveVariantIds(input);
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

    return resolveCanonicalDefaultVariantIdFromActiveVariantIds(input);
}
