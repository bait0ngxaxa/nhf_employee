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
        <div className="animate-in flex flex-col justify-between gap-6 fade-in slide-in-from-bottom-4 duration-700 ease-out lg:flex-row lg:items-end">
            <div className="flex items-center space-x-6">
                <div className="relative group cursor-default">
                    <div
                        className={cn(
                            "absolute -inset-3 rounded-[2rem] bg-gradient-to-r blur-2xl opacity-0 group-hover:opacity-40 transition-opacity duration-700",
                            iconGlow ?? toneClasses.iconGlow,
                        )}
                    />
                    <div
                        className={cn(
                            "relative flex items-center justify-center w-16 h-16 rounded-[1.5rem] bg-gradient-to-br shadow-xl ring-1 ring-content-on-brand/20 transition-transform duration-500 group-hover:scale-105 group-hover:rotate-3",
                            iconGradient ?? toneClasses.iconGradient,
                            iconShadow ?? toneClasses.iconShadow,
                        )}
                    >
                        <Icon className="h-8 w-8 text-content-on-brand" />
                    </div>
                </div>
                <div className="space-y-1">
                    <h1
                        data-page-heading
                        tabIndex={-1}
                        className="text-3xl font-black leading-none tracking-tighter text-content-primary sm:text-4xl lg:text-5xl"
                    >
                        {title}
                    </h1>
                    <p className="text-sm font-medium tracking-tight text-content-muted">
                        {subtitle}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                {roleBadge && (
                    <div
                        className={cn(
                            "px-4 py-1.5 text-xs font-black uppercase tracking-[0.2em] rounded-full border shadow-sm transition-all duration-300 hover:-translate-y-0.5",
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
