import { type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/ui/utils";

/**
 * SectionShell — shared dashboard section wrapper with background gradient effects.
 *
 * @param gradientFrom  CSS color for first radial gradient (top-right)
 * @param gradientTo    CSS color for second radial gradient (bottom-left)
 */
interface SectionShellProps {
    children: ReactNode;
    gradientFrom?: string;
    gradientTo?: string;
    className?: string;
}

export function SectionShell({
    children,
    gradientFrom = "var(--section-shell-gradient-from)",
    gradientTo = "var(--section-shell-gradient-to)",
    className = "",
}: SectionShellProps): ReactElement {
    const backgroundMesh = [
        `radial-gradient(circle at 82% 0%, ${gradientFrom} 0%, transparent 34%)`,
        `radial-gradient(circle at 0% 100%, ${gradientTo} 0%, transparent 38%)`,
    ].join(", ");

    return (
        <div
            className={cn(
                "relative isolate min-h-[calc(100dvh-6rem)] min-w-0 rounded-xl border border-border-soft bg-surface section-shell-shadow sm:rounded-2xl",
                className,
            )}
        >
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl sm:rounded-2xl">
                <div
                    className="absolute inset-0 opacity-40"
                    style={{
                        background: backgroundMesh,
                    }}
                />
                <div className="section-shell-overlay absolute inset-0" />
            </div>

            <div className="relative z-10 min-w-0 space-y-8 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:space-y-10 sm:p-6 sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))] lg:p-10 lg:pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
                {children}
            </div>
        </div>
    );
}
