/**
 * Maximal schema-valid Stock item payloads, used to prove that
 * STOCK_ITEM_JSON_MAX_REQUEST_BYTES fits the largest request the create/update
 * schemas accept. Every text field is filled to its `.max()` with Thai
 * characters (3 UTF-8 bytes each, the worst realistic case), every array to its
 * maximum length, and numbers use their longest safe-integer form.
 */

const THAI_BASE = 0x0e01; // "ก"
const MAX_VARIANTS = 20;
const MAX_ATTRIBUTES = 5;

function thai(length: number, discriminator = 0): string {
    const last = String.fromCharCode(THAI_BASE + (discriminator % 40));
    return "ก".repeat(length - 1) + last;
}

function maximalImageUrl(discriminator: number): string {
    const prefix = "https://example.com/";
    return prefix + thai(2000 - prefix.length, discriminator);
}

function maximalAttributes(variantIndex: number): Array<{ name: string; value: string }> {
    return Array.from({ length: MAX_ATTRIBUTES }, (_unused, attributeIndex) => ({
        // Names must be unique within a variant; values make each variant's
        // attribute signature unique across the item.
        name: thai(100, attributeIndex),
        value: thai(100, variantIndex),
    }));
}

export function buildMaximalCreateItemPayload(): Record<string, unknown> {
    return {
        name: thai(200),
        description: thai(2000),
        imageUrl: maximalImageUrl(0),
        sku: thai(50),
        unit: thai(50),
        quantity: Number.MAX_SAFE_INTEGER,
        minStock: Number.MAX_SAFE_INTEGER,
        categoryId: Number.MAX_SAFE_INTEGER,
        variants: Array.from({ length: MAX_VARIANTS }, (_unused, index) => ({
            sku: thai(50, index),
            unit: thai(50, index),
            quantity: Number.MAX_SAFE_INTEGER,
            minStock: Number.MAX_SAFE_INTEGER,
            imageUrl: maximalImageUrl(index),
            attributes: maximalAttributes(index),
        })),
    };
}

export function buildMaximalUpdateItemPayload(): Record<string, unknown> {
    return {
        name: thai(200),
        description: thai(2000),
        imageUrl: maximalImageUrl(0),
        sku: thai(50),
        unit: thai(50),
        minStock: Number.MAX_SAFE_INTEGER,
        categoryId: Number.MAX_SAFE_INTEGER,
        isActive: false,
        variants: Array.from({ length: MAX_VARIANTS }, (_unused, index) => ({
            id: Number.MAX_SAFE_INTEGER - index,
            expectedQuantity: Number.MAX_SAFE_INTEGER,
            sku: thai(50, index),
            unit: thai(50, index),
            quantity: Number.MAX_SAFE_INTEGER,
            minStock: Number.MAX_SAFE_INTEGER,
            imageUrl: maximalImageUrl(index),
            attributes: maximalAttributes(index),
        })),
    };
}
