import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
    iconGradient = "from-emerald-500 to-teal-700",
    iconGlow = "from-emerald-500/40 to-teal-500/40",
    iconShadow = "shadow-emerald-500/25",
    roleBadge,
    badgeColor = "bg-indigo-50 text-indigo-700 border-indigo-100",
    extra,
}: SectionHeaderProps) {
    return (
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 animate-in fade-in slide-in-from-bottom-2 duration-700 ease-out">
            <div className="flex items-center space-x-5">
                <div className="relative group cursor-default">
                    <div
                        className={`absolute -inset-2 rounded-2xl bg-gradient-to-r ${iconGlow} blur-xl opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-[opacity,transform] duration-500 will-change-transform`}
                    />
                    <div
                        className={`relative flex items-center justify-center w-14 h-14 bg-gradient-to-br ${iconGradient} rounded-2xl shadow-lg ${iconShadow} ring-1 ring-white/20`}
                    >
                        <Icon className="h-7 w-7 text-white" />
                    </div>
                </div>
                <div className="space-y-1">
                    <h2 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-gray-900 via-gray-800 to-gray-600 pb-1">
                        {title}
                    </h2>
                    <p className="text-gray-500 font-medium">{subtitle}</p>
                </div>
            </div>
            <div className="flex items-center gap-3">
                {roleBadge && (
                    <Badge
                        variant="secondary"
                        className={`px-3 py-1 text-sm font-semibold tracking-wide rounded-full border ${badgeColor} hover:opacity-90 transition-colors`}
                    >
                        {roleBadge}
                    </Badge>
                )}
                {extra}
            </div>
        </div>
    );
}
