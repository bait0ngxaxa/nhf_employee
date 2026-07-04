import Image from "next/image";
import type { ReactElement } from "react";
import logoImage from "@/public/NHFapp_logo_v1.png";
import { APP_LOGO } from "@/constants/brand";
import { cn } from "@/lib/ui/utils";

type AppLogoVariant = "navbar" | "sidebar" | "mark";

type AppLogoProps = {
    variant: AppLogoVariant;
    priority?: boolean;
    className?: string;
};

const LOGO_VARIANTS: Record<
    AppLogoVariant,
    {
        frameClassName: string;
    }
> = {
    navbar: {
        frameClassName: "size-10",
    },
    sidebar: {
        frameClassName: "size-10",
    },
    mark: {
        frameClassName: "size-10",
    },
};
const APP_LOGO_SIZE_PX = 40;

export function AppLogo({
    variant,
    priority = false,
    className,
}: AppLogoProps): ReactElement {
    const logo = LOGO_VARIANTS[variant];

    return (
        <span
            className={cn(
                "relative inline-block shrink-0 overflow-hidden rounded-[13%] bg-white shadow-[0_4px_8px_rgba(15,23,42,0.18),0_1px_2px_rgba(15,23,42,0.12)]",
                logo.frameClassName,
                className,
            )}
            aria-hidden="true"
        >
            <Image
                src={logoImage}
                alt={APP_LOGO.alt}
                width={APP_LOGO_SIZE_PX}
                height={APP_LOGO_SIZE_PX}
                priority={priority}
                sizes="40px"
                className="block h-full w-full object-contain"
            />
        </span>
    );
}
