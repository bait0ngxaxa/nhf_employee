import type { Prisma } from "@prisma/client";
import type { UpdateItemInput } from "@/lib/validations/stock";
import type { buildItemInclude } from "./shared";

export type StockTxClient = Prisma.TransactionClient;
export type SubmittedVariant = NonNullable<UpdateItemInput["variants"]>[number];
export type UploadUrlTracking = {
    cleanupCandidates: Set<string>;
    retainedUploadUrls: Set<string>;
};

export type ExistingItemRecord = {
    id: number;
    sku: string;
    unit: string;
    quantity: number;
    minStock: number;
    imageUrl: string | null;
    isActive: boolean;
};

export type ExistingVariantRecord = {
    id: number;
    sku: string;
    imageUrl: string | null;
    isActive: boolean;
};

export type StockItemWithDetails = Prisma.StockItemGetPayload<{
    include: ReturnType<typeof buildItemInclude>;
}>;

export function trackUploadUrl(
    url: string | null | undefined,
    retainedUploadUrls: Set<string>,
): void {
    if (url) {
        retainedUploadUrls.add(url);
    }
}

export function trackReplacedUploadUrl(
    previousUrl: string | null | undefined,
    nextUrl: string | null | undefined,
    tracking: UploadUrlTracking,
): void {
    if (previousUrl && previousUrl !== nextUrl) {
        tracking.cleanupCandidates.add(previousUrl);
    }
    trackUploadUrl(nextUrl, tracking.retainedUploadUrls);
}
