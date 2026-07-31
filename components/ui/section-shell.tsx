import { type ReactElement, type ReactNode } from "react";

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
    gradientFrom = "rgba(248,250,252,0.8)",
    gradientTo = "rgba(241,245,249,0.8)",
    className = "",
}: SectionShellProps): ReactElement {
    const backgroundMesh = [
        `radial-gradient(circle at 82% 0%, ${gradientFrom} 0%, transparent 34%)`,
        `radial-gradient(circle at 0% 100%, ${gradientTo} 0%, transparent 38%)`,
    ].join(", ");

    return (
        <div
            className={`relative min-h-[calc(100vh-6rem)] overflow-hidden rounded-2xl border border-slate-200/50 bg-white shadow-[0_20px_50px_-12px_rgba(0,0,0,0.03)] lg:rounded-[3rem] ${className}`}
        >
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl lg:rounded-[3rem]">
                <div
                    className="absolute inset-0 opacity-40"
                    style={{
                        background: backgroundMesh,
                    }}
                />
                <div className="absolute inset-0 bg-white/40" />
            </div>

            <div className="relative z-10 space-y-10 p-4 sm:p-6 lg:p-10">
                {children}
            </div>
        </div>
    );
}
