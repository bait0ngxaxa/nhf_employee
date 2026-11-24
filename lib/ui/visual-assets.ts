import { Boxes, CalendarRange, ClipboardCheck, Headset, type LucideIcon } from "lucide-react";

type VisualAssetDefinition = {
    src: string;
    compactSrc: string;
    fallback: LucideIcon;
};

export const VISUAL_ASSETS = {
    leave: {
        src: "/assets/modules/leave.svg",
        compactSrc: "/assets/modules/leave-compact.svg",
        fallback: CalendarRange,
    },
    stock: {
        src: "/assets/modules/stock.svg",
        compactSrc: "/assets/modules/stock-compact.svg",
        fallback: Boxes,
    },
    routine: {
        src: "/assets/modules/routine.svg",
        compactSrc: "/assets/modules/routine-compact.svg",
        fallback: ClipboardCheck,
    },
    "it-ticket": {
        src: "/assets/modules/it-ticket.svg",
        compactSrc: "/assets/modules/it-ticket-compact.svg",
        fallback: Headset,
    },
} as const satisfies Record<string, VisualAssetDefinition>;

export type VisualAssetKey = keyof typeof VISUAL_ASSETS;
