import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/ui/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Tab definition for SectionTabs.
 */
export interface SectionTabItem {
    value: string;
    label: string;
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
    /** Optional class override for the tab rail surface and border. */
    listClassName?: string;
    ariaLabel?: string;
}

export function SectionTabs({
    value,
    onValueChange,
    tabs,
    activeColor = "var(--brand-tab)",
    listClassName,
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
            className="min-w-0 space-y-6"
            style={tabStyle}
        >
            <div className="min-w-0 max-w-full overflow-x-auto pb-1 [touch-action:pan-x]">
                <TabsList
                    aria-label={ariaLabel}
                    className={cn(
                        "flex h-auto min-w-max flex-nowrap gap-1 rounded-xl border border-border-subtle bg-surface-subtle p-1 md:min-w-0 md:w-full",
                        listClassName,
                    )}
                    data-section-tabs=""
                >
                    {visibleTabs.map((tab) => {
                        return (
                            <TabsTrigger
                                key={tab.value}
                                value={tab.value}
                                className={cn(
                                    "flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent px-3 py-2 text-center text-sm font-medium leading-5 sm:px-4",
                                    "text-content-secondary hover:bg-surface hover:text-content-heading",
                                    "data-[state=active]:border-transparent data-[state=active]:bg-[var(--section-tab-active-color)] data-[state=active]:text-content-on-brand",
                                    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                    "motion-safe:transition-[background-color,border-color,color] motion-safe:duration-200 md:min-w-0 md:shrink md:flex-1 md:basis-0"
                                )}
                                ref={(node) => {
                                    triggerRefs.current[tab.value] = node;
                                }}
                            >
                                <span className="min-w-0 max-w-full md:line-clamp-2 md:whitespace-normal">
                                    {tab.label}
                                </span>
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
