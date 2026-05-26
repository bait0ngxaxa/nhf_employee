import { type ReactNode } from "react";

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
}: SectionShellProps) {
    const backgroundMesh = [
        `radial-gradient(circle at 82% 0%, ${gradientFrom} 0%, transparent 34%)`,
        `radial-gradient(circle at 0% 100%, ${gradientTo} 0%, transparent 38%)`,
    ].join(", ");

    return (
        <div
            className={`relative min-h-[calc(100vh-6rem)] bg-white rounded-[3rem] overflow-hidden border border-slate-200/50 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.03)] ${className}`}
        >
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[3rem]">
                <div
                    className="absolute inset-0 opacity-40"
                    style={{
                        background: backgroundMesh,
                    }}
                />
                <div className="absolute inset-0 bg-white/40" />
            </div>

            <div className="relative z-10 p-6 md:p-12 space-y-10">
                {children}
            </div>
        </div>
    );
}
