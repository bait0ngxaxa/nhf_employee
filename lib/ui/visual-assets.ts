import { Boxes, CalendarRange, ClipboardCheck, Headset, type LucideIcon } from "lucide-react";
import type { StaticImageData } from "next/image";
import itTicket from "@/public/assets/modules/it-ticket.svg";
import itTicketCompact from "@/public/assets/modules/it-ticket-compact.svg";
import leave from "@/public/assets/modules/leave.svg";
import leaveCompact from "@/public/assets/modules/leave-compact.svg";
import routine from "@/public/assets/modules/routine.svg";
import routineCompact from "@/public/assets/modules/routine-compact.svg";
import stock from "@/public/assets/modules/stock.svg";
import stockCompact from "@/public/assets/modules/stock-compact.svg";

type VisualAssetSource = string | StaticImageData;

type VisualAssetDefinition = {
    src: string;
    compactSrc: string;
    fallback: LucideIcon;
};

function assetUrl(source: VisualAssetSource): string {
    return typeof source === "string" ? source : source.src;
}

function defineAsset(
    src: VisualAssetSource,
    compactSrc: VisualAssetSource,
    fallback: LucideIcon,
): VisualAssetDefinition {
    return { src: assetUrl(src), compactSrc: assetUrl(compactSrc), fallback };
}

// Static imports use Next.js's public build assets, including on LINE sessions.
export const VISUAL_ASSETS = {
    leave: defineAsset(leave, leaveCompact, CalendarRange),
    stock: defineAsset(stock, stockCompact, Boxes),
    routine: defineAsset(routine, routineCompact, ClipboardCheck),
    "it-ticket": defineAsset(itTicket, itTicketCompact, Headset),
} as const;

export type VisualAssetKey = keyof typeof VISUAL_ASSETS;
