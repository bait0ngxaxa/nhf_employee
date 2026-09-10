import { Fragment, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
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
    /** Optional visual grouping for related workspaces. */
    group?: string;
    /** Visible label shown before the first tab in a group. */
    groupLabel?: string;
}

interface SectionTabsProps {
    value: string;
    onValueChange: (value: string) => void;
    tabs: SectionTabItem[];
    /** Semantic CSS token for the active tab accent. */
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
            <div className="min-w-0 max-w-full overflow-x-auto border-b border-border-subtle [touch-action:pan-x]">
                <TabsList
                    aria-label={ariaLabel}
                    className={cn(
                        "flex h-auto min-w-max flex-nowrap gap-0 rounded-none border-0 bg-transparent p-0 md:min-w-0 md:w-full",
                        listClassName,
                    )}
                    data-section-tabs=""
                >
                    {visibleTabs.map((tab, index) => {
                        const previousTab = visibleTabs[index - 1];
                        const isGroupStart = tab.group !== undefined
                            && (index === 0 || tab.group !== previousTab?.group);
                        const hasGroupSeparator = isGroupStart && index > 0;

                        return (
                            <Fragment key={tab.value}>
                                {isGroupStart ? (
                                    <>
                                        {hasGroupSeparator ? (
                                            <span
                                                aria-hidden="true"
                                                role="presentation"
                                                className="mx-2 h-6 w-px shrink-0 bg-border-subtle"
                                            />
                                        ) : null}
                                        {tab.groupLabel ? (
                                            <span
                                                aria-hidden="true"
                                                role="presentation"
                                                className="shrink-0 px-1 text-[10px] font-bold tracking-wide text-content-muted"
                                            >
                                                {tab.groupLabel}
                                            </span>
                                        ) : null}
                                    </>
                                ) : null}
                                <TabsTrigger
                                    value={tab.value}
                                    className={cn(
                                        "relative flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-none border-b-2 border-transparent px-3 py-3 text-center text-sm font-medium leading-5 sm:px-4",
                                        "text-content-secondary hover:bg-surface-subtle hover:text-content-heading",
                                        "data-[state=active]:border-b-[var(--section-tab-active-color)] data-[state=active]:bg-transparent data-[state=active]:text-[var(--section-tab-active-color)] data-[state=active]:shadow-none",
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
                            </Fragment>
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
