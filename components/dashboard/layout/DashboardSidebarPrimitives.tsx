import { useEffect, useState, type ReactElement } from "react";
import { ChevronDown, Home, PanelLeft, PanelLeftClose, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppLogo } from "@/components/brand/AppLogo";
import { cn } from "@/lib/ui/utils";
import { type MenuGroup, type MenuItem } from "@/types/dashboard";
import { CollapsedSidebarTooltip } from "@/components/dashboard/layout/CollapsedSidebarTooltip";

const HOME_MENU_ITEM: MenuItem = {
    id: "dashboard",
    label: "Overview",
    icon: Home,
    description: "Main Dashboard",
};

type MenuItemProps = {
    item: MenuItem;
    isActive: boolean;
    sidebarOpen: boolean;
    indented: boolean;
    onClick: () => void;
};

type MenuGroupProps = {
    group: MenuGroup;
    selectedMenu: string;
    sidebarOpen: boolean;
    isExpanded: boolean;
    onToggle: () => void;
    onItemClick: (menuId: string) => void;
};

type SidebarHeaderProps = {
    sidebarOpen: boolean;
    onToggle: () => void;
};

type CollapsedSidebarToggleButtonProps = {
    onToggle: () => void;
};

type SidebarNavProps = {
    sidebarOpen: boolean;
    selectedMenu: string;
    availableMenuGroups: MenuGroup[];
    expandedGroups: ReadonlySet<string>;
    toggleGroup: (groupId: string) => void;
    handleMenuClick: (menuId: string) => void;
};

type SidebarFooterProps = {
    sidebarOpen: boolean;
    name: string;
    role: string;
};

function getItemLabel(item: MenuItem): string {
    return item.comingSoon ? `${item.label} (เร็วๆ นี้)` : item.label;
}

function SidebarMenuItem({
    item,
    isActive,
    sidebarOpen,
    indented,
    onClick,
}: MenuItemProps): ReactElement {
    const IconComponent = item.icon;
    const disabled = item.comingSoon === true;
    const itemLabel = getItemLabel(item);

    return (
        <div className="px-2">
            <CollapsedSidebarTooltip
                active={!sidebarOpen}
                label={itemLabel}
                description={item.description}
            >
                <Button
                    type="button" variant="ghost" disabled={disabled}
                    aria-current={isActive ? "page" : undefined}
                    aria-label={sidebarOpen ? undefined : itemLabel}
                    title={sidebarOpen ? undefined : itemLabel}
                    className={cn(
                        "group/sidebar-item h-11 w-full justify-start gap-3 rounded-xl border border-transparent text-sm font-medium transition-[background-color,border-color,color,opacity] duration-200 focus-visible:ring-sidebar-ring/50 focus-visible:ring-[3px]",
                        isActive ? "border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                        !sidebarOpen && "justify-center px-0",
                        indented && sidebarOpen && "h-10 pl-9",
                        disabled && "cursor-not-allowed opacity-55",
                    )}
                    onClick={disabled ? undefined : onClick}
                >
                    <span
                        className={cn(
                            "flex shrink-0 items-center justify-center rounded-lg transition-[background-color,color] duration-200",
                            indented && sidebarOpen ? "size-5" : "size-7",
                            isActive ? "bg-gradient-to-br from-sky-400 to-indigo-500 text-white" : "text-sidebar-foreground/60 group-hover/sidebar-item:text-sidebar-accent-foreground",
                        )}
                    >
                        <IconComponent aria-hidden="true" className={indented && sidebarOpen ? "size-3.5" : "size-4"} />
                    </span>
                    {sidebarOpen && (
                        <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                    )}
                    {sidebarOpen && disabled && (
                        <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                            เร็วๆ นี้
                        </span>
                    )}
                </Button>
            </CollapsedSidebarTooltip>
        </div>
    );
}

function SidebarMenuGroup({
    group,
    selectedMenu,
    sidebarOpen,
    isExpanded,
    onToggle,
    onItemClick,
}: MenuGroupProps): ReactElement {
    const contentId = `sidebar-group-${group.id}`, active = group.items.some((item) => item.id === selectedMenu);

    if (!sidebarOpen) {
        return (
            <div className="mb-3 space-y-1">
                {group.items.map((item) => (
                    <SidebarMenuItem key={item.id} item={item}
                        isActive={selectedMenu === item.id} sidebarOpen={false}
                        indented={false} onClick={() => onItemClick(item.id)}
                    />
                ))}
            </div>
        );
    }

    return (
        <section className="mb-4 space-y-1" aria-label={group.label}>
            <button
                type="button" aria-expanded={isExpanded}
                aria-controls={contentId}
                onClick={onToggle}
                className={cn(
                    "flex h-9 w-full items-center gap-2 rounded-lg px-5 text-left text-xs font-semibold transition-[background-color,color] duration-200 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50",
                    active ? "text-sidebar-foreground" : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
            >
                <span className="min-w-0 flex-1 truncate">{group.label}</span>
                <ChevronDown
                    aria-hidden="true"
                    className={cn("size-3 shrink-0 transition-transform duration-200", isExpanded && "rotate-180")}
                />
            </button>
            <div id={contentId} hidden={!isExpanded} className="mt-1 space-y-1">
                {group.items.map((item) => (
                    <SidebarMenuItem key={item.id} item={item}
                        isActive={selectedMenu === item.id} sidebarOpen
                        indented onClick={() => onItemClick(item.id)}
                    />
                ))}
            </div>
        </section>
    );
}

export function useExpandedSidebarGroups(availableMenuGroups: MenuGroup[]): {
    expandedGroups: ReadonlySet<string>;
    toggleGroup: (groupId: string) => void;
} {
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
        () => new Set(availableMenuGroups.map((group) => group.id)),
    );

    useEffect(() => {
        setExpandedGroups((current) => {
            const next = new Set(current);
            availableMenuGroups.forEach((group) => next.add(group.id));
            return next;
        });
    }, [availableMenuGroups]);

    function toggleGroup(groupId: string): void {
        setExpandedGroups((current) => {
            const next = new Set(current);
            if (next.has(groupId)) {
                next.delete(groupId);
            } else {
                next.add(groupId);
            }
            return next;
        });
    }

    return { expandedGroups, toggleGroup };
}

function CollapsedSidebarToggleButton({
    onToggle,
}: CollapsedSidebarToggleButtonProps): ReactElement {
    return (
        <CollapsedSidebarTooltip
            active
            label="ขยายเมนู"
            description="เปิดแถบเมนูด้านข้าง"
        >
            <Button
                type="button"
                variant="ghost"
                size="icon-lg"
                className="group/sidebar-logo relative rounded-[13%] p-0 hover:bg-transparent focus-visible:ring-[3px] focus-visible:ring-sidebar-ring/50"
                aria-label="ขยายเมนู"
                aria-expanded={false}
                onClick={onToggle}
            >
                <AppLogo
                    variant="mark"
                    priority
                    className="transition-opacity duration-150 ease-out group-hover/sidebar-logo:opacity-0 group-focus-visible/sidebar-logo:opacity-0"
                />
                <span className="absolute inset-0 flex items-center justify-center rounded-[13%] bg-sidebar-accent text-sidebar-foreground opacity-0 shadow-[0_4px_8px_rgba(15,23,42,0.18),0_1px_2px_rgba(15,23,42,0.12)] transition-opacity duration-150 ease-out group-hover/sidebar-logo:opacity-100 group-focus-visible/sidebar-logo:opacity-100">
                    <PanelLeft aria-hidden="true" className="size-4" />
                </span>
            </Button>
        </CollapsedSidebarTooltip>
    );
}

export function SidebarHeader({
    sidebarOpen,
    onToggle,
}: SidebarHeaderProps): ReactElement {
    if (!sidebarOpen) {
        return (
            <div className="flex flex-col items-center gap-3 p-4 transition-[padding] duration-200">
                <CollapsedSidebarToggleButton onToggle={onToggle} />
            </div>
        );
    }

    return (
        <div className="flex items-center gap-4 p-6 transition-[padding] duration-200">
            <AppLogo variant="sidebar" priority />
            <div className="min-w-0 flex-1">
                <h1 className="truncate text-lg font-bold leading-6">NHFapp</h1>
            </div>
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="hidden shrink-0 rounded-lg border border-sidebar-border bg-sidebar-accent text-sidebar-foreground hover:bg-accent md:inline-flex"
                aria-label="ย่อเมนู"
                aria-expanded={true}
                onClick={onToggle}
            >
                <PanelLeftClose aria-hidden="true" className="size-4" />
            </Button>
        </div>
    );
}

export function SidebarNav({
    sidebarOpen,
    selectedMenu,
    availableMenuGroups,
    expandedGroups,
    toggleGroup,
    handleMenuClick,
}: SidebarNavProps): ReactElement {
    return (
        <nav
            className={cn("flex-1 overflow-y-auto overflow-x-hidden pb-3", sidebarOpen ? "px-2" : "px-0")}
            aria-label="เมนูหลัก"
        >
            <div className="mb-4 space-y-1">
                <SidebarMenuItem
                    item={HOME_MENU_ITEM} indented={false}
                    isActive={selectedMenu === HOME_MENU_ITEM.id}
                    sidebarOpen={sidebarOpen}
                    onClick={() => handleMenuClick(HOME_MENU_ITEM.id)}
                />
            </div>
            {availableMenuGroups.map((group) => (
                <SidebarMenuGroup
                    key={group.id} group={group}
                    selectedMenu={selectedMenu} sidebarOpen={sidebarOpen}
                    isExpanded={expandedGroups.has(group.id)}
                    onToggle={() => toggleGroup(group.id)} onItemClick={handleMenuClick}
                />
            ))}
        </nav>
    );
}

export function SidebarFooter({
    sidebarOpen,
    name,
    role,
}: SidebarFooterProps): ReactElement {
    return (
        <div className={cn("border-t border-sidebar-border transition-[padding] duration-200", sidebarOpen ? "p-4" : "p-3")}>
            <div
                className={cn(
                    "flex min-w-0 items-center rounded-xl bg-sidebar-accent text-sidebar-accent-foreground",
                    sidebarOpen ? "gap-3 p-3" : "justify-center p-2",
                )}
                title={name}
            >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background text-primary">
                    <User aria-hidden="true" className="size-4" />
                </div>
                {sidebarOpen && (
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{name}</p>
                        <p className="truncate text-xs text-sidebar-foreground/65">{role}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
