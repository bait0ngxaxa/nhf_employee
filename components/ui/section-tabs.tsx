import { useEffect, useRef, type ReactNode } from "react";
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

/**
 * SectionTabs — shared pill-style tabs matching IT Support design.
 *
 * Uses CSS custom property `--tab-active-color` to apply the active text color.
 */
interface SectionTabsProps {
    value: string;
    onValueChange: (value: string) => void;
    tabs: SectionTabItem[];
    /** CSS color for the active tab text (any valid CSS value, e.g. "#ea580c") */
    activeColor?: string;
}

export function SectionTabs({
    value,
    onValueChange,
    tabs,
    activeColor = "#0ea5e9", // default sky-500
}: SectionTabsProps) {
    const visibleTabs = tabs.filter((t) => t.visible !== false);
    const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

    useEffect(() => {
        const activeTrigger = triggerRefs.current[value];
        if (!activeTrigger) {
            return;
        }

        activeTrigger.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "nearest",
        });
    }, [value]);

    return (
        <Tabs
            value={value}
            onValueChange={onValueChange}
            className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700 ease-out"
        >
            {/* Scoped CSS for active tab background and shadow via custom property */}
            <style>{`
                [data-section-tabs] [data-state="active"] {
                    background-color: ${activeColor} !important;
                    box-shadow: 0 10px 15px -3px ${activeColor}33 !important;
                }
            `}</style>

            <div className="mb-4 w-full overflow-x-auto pb-2">
                <TabsList
                    className="flex h-auto min-w-max flex-nowrap gap-2 rounded-[1.75rem] bg-slate-50 border border-slate-100 p-1.5 hide-scrollbar md:min-w-0 md:w-full"
                    data-section-tabs=""
                >
                    {visibleTabs.map((tab) => {
                        const TabIcon = tab.icon;
                        return (
                            <TabsTrigger
                                key={tab.value}
                                value={tab.value}
                                className={cn(
                                    "shrink-0 md:flex-1 flex items-center justify-center gap-2.5 rounded-[1.25rem] px-6 py-3",
                                    "data-[state=active]:text-white",
                                    "transition-all duration-500",
                                    "text-slate-400 hover:text-slate-900 font-bold tracking-tight whitespace-nowrap"
                                )}
                                ref={(node) => {
                                    triggerRefs.current[tab.value] = node;
                                }}
                            >
                                {TabIcon && (
                                    <TabIcon className="h-4 w-4 shrink-0 transition-transform duration-500 group-data-[state=active]:scale-110" />
                                )}
                                <span className="text-xs uppercase tracking-[0.1em]">{tab.label}</span>
                            </TabsTrigger>
                        );
                    })}
                </TabsList>
            </div>

            {visibleTabs.map((tab) => (
                <TabsContent
                    key={tab.value}
                    value={tab.value}
                    className="mt-0 focus-visible:outline-none animate-in fade-in slide-in-from-bottom-4 duration-500"
                >
                    {tab.content}
                </TabsContent>
            ))}
        </Tabs>
    );
}
