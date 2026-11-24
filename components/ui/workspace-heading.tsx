import type { ReactElement, ReactNode } from "react";

import { BrandAsset } from "@/components/brand/BrandAsset";
import { cn } from "@/lib/ui/utils";
import type { VisualAssetKey } from "@/lib/ui/visual-assets";

export function WorkspaceHeading({
    asset,
    size = "administrative",
    className,
    muted = false,
    children,
}: {
    asset: VisualAssetKey;
    size?: "module" | "administrative" | "liff";
    className?: string;
    muted?: boolean;
    children: ReactNode;
}): ReactElement {
    return (
        <div className="flex min-w-0 items-start gap-3">
            <BrandAsset
                asset={asset}
                alt=""
                size={size === "module" ? "xl" : size === "administrative" ? "lg" : "md"}
                className={cn(
                    size === "module" && "size-12 lg:size-16",
                    size === "administrative" && "size-8 sm:size-12",
                    muted && "grayscale",
                )}
            />
            <div className={cn("min-w-0", className)}>{children}</div>
        </div>
    );
}
