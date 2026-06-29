import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/ui/utils";

/**
 * SectionHeader — shared dashboard section header with glowing icon, title,
 * subtitle, and optional role badge.
 */
interface SectionHeaderProps {
    icon: LucideIcon;
    title: string;
    subtitle: string;
    /** Gradient classes for the icon background, e.g. "from-emerald-500 to-teal-700" */
    iconGradient?: string;
    /** Glow color classes, e.g. "from-emerald-500/40 to-teal-500/40" */
    iconGlow?: string;
    /** Shadow color class, e.g. "shadow-emerald-500/25" */
    iconShadow?: string;
    /** Role badge text */
    roleBadge?: string;
    /** Badge accent color classes, e.g. "bg-indigo-50 text-indigo-700 border-indigo-100" */
    badgeColor?: string;
    /** Optional extra elements (e.g. department badge) */
    extra?: ReactNode;
}

export function SectionHeader({
    icon: Icon,
    title,
    subtitle,
    iconGradient = "from-sky-500 to-indigo-600",
    iconGlow = "from-sky-500/20 to-indigo-500/10",
    iconShadow = "shadow-sky-100",
    roleBadge,
    badgeColor = "bg-sky-50 text-sky-600 border-sky-100/50",
    extra,
}: SectionHeaderProps) {
    return (
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
            <div className="flex items-center space-x-6">
                <div className="relative group cursor-default">
                    <div
                        className={cn(
                            "absolute -inset-3 rounded-[2rem] bg-gradient-to-r blur-2xl opacity-0 group-hover:opacity-40 transition-opacity duration-700",
                            iconGlow,
                        )}
                    />
                    <div
                        className={cn(
                            "relative flex items-center justify-center w-16 h-16 rounded-[1.5rem] bg-gradient-to-br shadow-xl ring-1 ring-white/20 transition-transform duration-500 group-hover:scale-105 group-hover:rotate-3",
                            iconGradient,
                            iconShadow,
                        )}
                    >
                        <Icon className="h-8 w-8 text-white" />
                    </div>
                </div>
                <div className="space-y-1">
                    <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-slate-900 leading-none">
                        {title}
                    </h2>
                    <p className="text-sm text-slate-500 font-medium tracking-tight">
                        {subtitle}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                {roleBadge && (
                    <div
                        className={cn(
                            "px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] rounded-full border shadow-sm transition-all duration-300 hover:-translate-y-0.5",
                            badgeColor,
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
