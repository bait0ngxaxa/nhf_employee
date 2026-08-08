import { type ReactElement, type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/ui/utils";

export type SectionHeaderTone = "brand" | "it" | "leave" | "stock";

const SECTION_HEADER_TONES: Record<
    SectionHeaderTone,
    {
        iconGradient: string;
        iconGlow: string;
        iconShadow: string;
        badgeColor: string;
    }
> = {
    brand: {
        iconGradient: "from-brand-start to-brand-end",
        iconGlow: "from-brand-start/20 to-brand-end/10",
        iconShadow: "shadow-brand-shadow",
        badgeColor: "bg-brand-surface text-brand-foreground border-brand-border/50",
    },
    it: {
        iconGradient: "from-module-it-start to-module-it-end",
        iconGlow: "from-module-it-start/40 to-module-it-glow-end/40",
        iconShadow: "shadow-module-it-start/25",
        badgeColor:
            "bg-module-it-badge-surface text-module-it-badge-foreground border-module-it-badge-border",
    },
    leave: {
        iconGradient: "from-module-leave-start to-module-leave-end",
        iconGlow: "from-module-leave-start/40 to-module-leave-glow-end/40",
        iconShadow: "shadow-module-leave-start/25",
        badgeColor:
            "bg-module-leave-badge-surface text-module-leave-badge-foreground border-module-leave-badge-border",
    },
    stock: {
        iconGradient: "from-module-stock-start to-module-stock-end",
        iconGlow: "from-module-stock-start/40 to-module-stock-glow-end/30",
        iconShadow: "shadow-module-stock-start/25",
        badgeColor:
            "bg-module-stock-badge-surface text-module-stock-badge-foreground border-module-stock-badge-border",
    },
};

/**
 * SectionHeader — shared dashboard section header with glowing icon, title,
 * subtitle, and optional role badge.
 */
interface SectionHeaderProps {
    icon: LucideIcon;
    title: string;
    subtitle: string;
    /** Centralized accent tone for the section's icon and role badge. */
    tone?: SectionHeaderTone;
    /** Optional class override for the icon background; prefer the centralized tone. */
    iconGradient?: string;
    /** Optional class override for the icon glow; prefer the centralized tone. */
    iconGlow?: string;
    /** Optional class override for the icon shadow; prefer the centralized tone. */
    iconShadow?: string;
    /** Role badge text */
    roleBadge?: string;
    /** Optional class override for the role badge; prefer the centralized tone. */
    badgeColor?: string;
    /** Optional extra elements (e.g. department badge) */
    extra?: ReactNode;
}

export function SectionHeader({
    icon: Icon,
    title,
    subtitle,
    tone = "brand",
    iconGradient,
    iconGlow,
    iconShadow,
    roleBadge,
    badgeColor,
    extra,
}: SectionHeaderProps): ReactElement {
    const toneClasses = SECTION_HEADER_TONES[tone];

    return (
        <div className="animate-in flex min-w-0 flex-col justify-between gap-4 fade-in slide-in-from-bottom-4 duration-700 ease-out sm:gap-6 lg:flex-row lg:items-end">
            <div className="flex min-w-0 items-center gap-4 sm:gap-5 lg:gap-6">
                <div className="relative group cursor-default">
                    <div
                        className={cn(
                            "absolute -inset-2 rounded-2xl bg-gradient-to-r blur-2xl opacity-0 transition-opacity duration-700 group-hover:opacity-40 sm:-inset-3",
                            iconGlow ?? toneClasses.iconGlow,
                        )}
                    />
                    <div
                        className={cn(
                            "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br shadow-xl ring-1 ring-content-on-brand/20 transition-transform duration-500 group-hover:scale-105 group-hover:rotate-3 sm:h-14 sm:w-14 sm:rounded-2xl lg:h-16 lg:w-16",
                            iconGradient ?? toneClasses.iconGradient,
                            iconShadow ?? toneClasses.iconShadow,
                        )}
                    >
                        <Icon className="h-6 w-6 text-content-on-brand sm:h-7 sm:w-7 lg:h-8 lg:w-8" />
                    </div>
                </div>
                <div className="min-w-0 space-y-1">
                    <h1
                        data-page-heading
                        tabIndex={-1}
                        className="text-2xl font-bold leading-tight tracking-tight text-content-primary [overflow-wrap:anywhere] sm:text-3xl lg:text-4xl"
                    >
                        {title}
                    </h1>
                    <p className="text-sm font-medium leading-5 tracking-tight text-content-muted [overflow-wrap:anywhere]">
                        {subtitle}
                    </p>
                </div>
            </div>
            <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:gap-3 lg:w-auto lg:justify-end">
                {roleBadge && (
                    <div
                        className={cn(
                            "max-w-full rounded-full border px-3 py-1.5 text-center text-xs font-bold leading-5 tracking-wide shadow-sm transition-all duration-300 hover:-translate-y-0.5 sm:px-4",
                            badgeColor ?? toneClasses.badgeColor,
                        )}
                    >
                        {roleBadge}
                    </div>
                )}
                {extra}
            </div>
        </div>
    );
}
