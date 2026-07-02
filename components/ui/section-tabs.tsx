import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/ui/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Tab definition for SectionTabs.
 */
export interface SectionTabItem {
    value: string;
    label: string;
    icon?: LucideIcon;
    content: ReactNode;
    /** Whether this tab is conditionally shown */
    visible?: boolean;
}

interface SectionTabsProps {
    value: string;
    onValueChange: (value: string) => void;
    tabs: SectionTabItem[];
    /** CSS color for the active tab background (any valid CSS value, e.g. "#ea580c") */
    activeColor?: string;
    ariaLabel?: string;
}

export function SectionTabs({
    value,
    onValueChange,
    tabs,
    activeColor = "#0369a1",
    ariaLabel = "แท็บของส่วนงาน",
}: SectionTabsProps) {
    const visibleTabs = tabs.filter((t) => t.visible !== false);
    const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
    const tabStyle: CSSProperties & { "--section-tab-active-color": string } = {
        "--section-tab-active-color": activeColor,
    };

    useEffect(() => {
        const activeTrigger = triggerRefs.current[value];
        if (!activeTrigger) {
            return;
        }

        const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        activeTrigger.scrollIntoView({
            behavior: prefersReducedMotion ? "auto" : "smooth",
            block: "nearest",
            inline: "nearest",
        });
    }, [value]);

    return (
        <Tabs
            value={value}
            onValueChange={onValueChange}
            className="space-y-6"
            style={tabStyle}
        >
            <div className="w-full overflow-x-auto pb-1">
                <TabsList
                    aria-label={ariaLabel}
                    className="flex h-auto min-w-max flex-nowrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 md:min-w-0 md:w-full"
                    data-section-tabs=""
                >
                    {visibleTabs.map((tab) => {
                        const TabIcon = tab.icon;
                        return (
                            <TabsTrigger
                                key={tab.value}
                                value={tab.value}
                                className={cn(
                                    "flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent px-4 py-2 text-sm font-medium",
                                    "text-slate-600 hover:bg-white hover:text-slate-950",
                                    "data-[state=active]:border-transparent data-[state=active]:bg-[var(--section-tab-active-color)] data-[state=active]:text-white",
                                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                    "motion-safe:transition-[background-color,border-color,color] motion-safe:duration-200 md:flex-1"
                                )}
                                ref={(node) => {
                                    triggerRefs.current[tab.value] = node;
                                }}
                            >
                                {TabIcon && (
                                    <TabIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                                )}
                                <span className="truncate">{tab.label}</span>
                            </TabsTrigger>
                        );
                    })}
                </TabsList>
            </div>

            {visibleTabs.map((tab) => (
                <TabsContent
                    key={tab.value}
                    value={tab.value}
                    className="mt-0 min-w-0 focus-visible:outline-none"
                >
                    {tab.content}
                </TabsContent>
            ))}
        </Tabs>
    );
}
