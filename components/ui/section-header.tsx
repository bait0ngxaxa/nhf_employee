import { type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/ui/utils";

/**
 * SectionHeader — shared dashboard section header with typography-first
 * hierarchy, subtitle, and optional role badge.
 */
interface SectionHeaderProps {
    title: string;
    subtitle: string;
    /** Role badge text */
    roleBadge?: string;
    /** Optional class override for a meaningful role badge. */
    badgeColor?: string;
    /** Optional extra elements (e.g. department badge) */
    extra?: ReactNode;
}

export function SectionHeader({
    title,
    subtitle,
    roleBadge,
    badgeColor,
    extra,
}: SectionHeaderProps): ReactElement {
    return (
        <div className="flex min-w-0 flex-col justify-between gap-4 sm:gap-6 lg:flex-row lg:items-end">
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
            <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:gap-3 lg:w-auto lg:justify-end">
                {roleBadge && (
                    <div
                        className={cn(
                            "max-w-full rounded-full border px-3 py-1.5 text-center text-xs font-bold leading-5 tracking-wide sm:px-4",
                            badgeColor ?? "bg-brand-surface text-brand-foreground border-brand-border/50",
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
