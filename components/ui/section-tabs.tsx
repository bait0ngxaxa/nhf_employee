import { useEffect, useRef, type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
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

const TAB_TRIGGER_CLASS =
    "shrink-0 md:flex-1 flex items-center justify-center gap-2 rounded-full px-6 py-2.5 " +
    "data-[state=active]:bg-white data-[state=active]:shadow-sm " +
    "transition-[color,background-color,box-shadow] " +
    "text-gray-600 hover:text-gray-900 font-medium whitespace-nowrap";

export function SectionTabs({
    value,
    onValueChange,
    tabs,
    activeColor = "#4f46e5", // default indigo-600
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
            className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700 ease-out"
        >
            {/* Scoped CSS for active tab color via custom property */}
            <style>{`
                [data-section-tabs] [data-state="active"] {
                    color: ${activeColor} !important;
                }
            `}</style>

            <div className="mb-2 w-full overflow-x-auto pb-1">
                <TabsList
                    className="flex h-auto min-w-max flex-nowrap gap-1 rounded-[2rem] bg-gray-100 p-1.5 shadow-inner hide-scrollbar md:min-w-0 md:w-full"
                    data-section-tabs=""
                >
                    {visibleTabs.map((tab) => {
                        const TabIcon = tab.icon;
                        return (
                            <TabsTrigger
                                key={tab.value}
                                value={tab.value}
                                className={TAB_TRIGGER_CLASS}
                                ref={(node) => {
                                    triggerRefs.current[tab.value] = node;
                                }}
                            >
                                {TabIcon && (
                                    <TabIcon className="h-4 w-4 shrink-0" />
                                )}
                                <span>{tab.label}</span>
                            </TabsTrigger>
                        );
                    })}
                </TabsList>
            </div>

            {visibleTabs.map((tab) => (
                <TabsContent
                    key={tab.value}
                    value={tab.value}
                    className="mt-0 focus-visible:outline-none"
                >
                    {tab.content}
                </TabsContent>
            ))}
        </Tabs>
    );
}
