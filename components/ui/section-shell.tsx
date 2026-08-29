import { type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/ui/utils";

/** SectionShell — shared dashboard section surface and responsive content frame. */
interface SectionShellProps {
    children: ReactNode;
    className?: string;
}

export function SectionShell({
    children,
    className = "",
}: SectionShellProps): ReactElement {
    return (
        <div
            className={cn(
                "min-h-[calc(100dvh-6rem)] min-w-0 rounded-xl border border-border-soft bg-surface sm:rounded-2xl",
                className,
            )}
        >
            <div className="min-w-0 space-y-8 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:space-y-10 sm:p-6 sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))] lg:p-10 lg:pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
                {children}
            </div>
        </div>
    );
}
