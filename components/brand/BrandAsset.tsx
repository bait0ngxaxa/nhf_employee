"use client";

import Image from "next/image";
import { useState, type ReactElement } from "react";
import { cn } from "@/lib/ui/utils";
import { VISUAL_ASSETS, type VisualAssetKey } from "@/lib/ui/visual-assets";

const SIZES = {
    xs: { pixels: 20, className: "size-5" },
    sm: { pixels: 24, className: "size-6" },
    md: { pixels: 32, className: "size-8" },
    lg: { pixels: 48, className: "size-12" },
    xl: { pixels: 64, className: "size-16" },
    "2xl": { pixels: 96, className: "size-24" },
} as const;

type BrandAssetProps = {
    asset: VisualAssetKey;
    variant?: "primary" | "compact";
    size?: keyof typeof SIZES;
    className?: string;
    /** Leave empty when adjacent text already identifies the destination. */
    alt?: string;
};

type ArtworkProps = {
    src: string;
    pixels: number;
    alt: string;
    variant: NonNullable<BrandAssetProps["variant"]>;
    fallback: (typeof VISUAL_ASSETS)[VisualAssetKey]["fallback"];
};

function Artwork({ src, pixels, alt, variant, fallback: Fallback }: ArtworkProps): ReactElement {
    const [failed, setFailed] = useState(false);

    if (failed) {
        return (
            <Fallback
                className={variant === "compact" ? "size-4/5" : "size-[min(80%,max(50%,1.25rem))]"}
                role={alt ? "img" : undefined}
                aria-label={alt || undefined}
                aria-hidden={alt ? undefined : true}
            />
        );
    }

    return (
        <Image
            src={src}
            width={pixels}
            height={pixels}
            alt={alt}
            unoptimized
            className="size-full"
            onError={() => setFailed(true)}
        />
    );
}

export function BrandAsset({
    asset,
    variant = "primary",
    size = "xl",
    className,
    alt = "",
}: BrandAssetProps): ReactElement {
    const definition = VISUAL_ASSETS[asset];
    const src = variant === "compact" ? definition.compactSrc : definition.src;
    const preset = SIZES[size];

    return (
        <span className={cn("inline-flex shrink-0 items-center justify-center", preset.className, className)}>
            <Artwork key={src} src={src} pixels={preset.pixels} alt={alt} variant={variant} fallback={definition.fallback} />
        </span>
    );
}
