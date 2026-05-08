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
    return (
        <div
            className={`relative min-h-[calc(100vh-6rem)] bg-white rounded-[3rem] overflow-hidden border border-slate-200/50 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.03)] ${className}`}
        >
            {/* Background Aesthetic Effects - Sophisticated Mesh */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[3rem]">
                <div
                    className="absolute top-0 right-0 w-[800px] h-[800px] -translate-y-1/2 translate-x-1/3 opacity-40 blur-[120px]"
                    style={{
                        background: `radial-gradient(circle at center, ${gradientFrom} 0%, transparent 70%)`,
                    }}
                />
                <div
                    className="absolute bottom-0 left-0 w-[1000px] h-[1000px] translate-y-1/3 -translate-x-1/4 opacity-40 blur-[100px]"
                    style={{
                        background: `radial-gradient(circle at center, ${gradientTo} 0%, transparent 70%)`,
                    }}
                />
                
                {/* Subtle Grain/Texture if needed, but let's keep it clean */}
                <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px]" />
            </div>

            <div className="relative z-10 p-6 md:p-12 space-y-10">
                {children}
            </div>
        </div>
    );
}
