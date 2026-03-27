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
    gradientFrom = "rgba(219,234,254,0.6)",
    gradientTo = "rgba(224,231,255,0.6)",
    className = "",
}: SectionShellProps) {
    return (
        <div
            className={`relative min-h-[calc(100vh-6rem)] bg-slate-50/50 rounded-3xl overflow-hidden border border-white/60 shadow-inner ${className}`}
        >
            {/* Background Aesthetic Effects */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
                <div
                    className="absolute top-0 right-0 w-[800px] h-[800px] -translate-y-1/2 translate-x-1/3"
                    style={{
                        background: `radial-gradient(circle at center, ${gradientFrom} 0%, transparent 70%)`,
                    }}
                />
                <div
                    className="absolute bottom-0 left-0 w-[1000px] h-[1000px] translate-y-1/3 -translate-x-1/4"
                    style={{
                        background: `radial-gradient(circle at center, ${gradientTo} 0%, transparent 70%)`,
                    }}
                />
            </div>

            <div className="relative z-10 p-4 md:p-8 space-y-6">
                {children}
            </div>
        </div>
    );
}
