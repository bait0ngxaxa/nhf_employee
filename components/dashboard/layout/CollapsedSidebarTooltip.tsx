import { type ReactElement, type ReactNode } from "react";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";

type CollapsedSidebarTooltipProps = {
    active: boolean;
    label: string;
    description?: string;
    children: ReactElement;
};

export function CollapsedSidebarTooltip({
    active,
    label,
    description,
    children,
}: CollapsedSidebarTooltipProps): ReactElement {
    if (!active) {
        return children;
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span className="inline-flex w-full">{children}</span>
            </TooltipTrigger>
            <TooltipContent
                side="right"
                align="center"
                sideOffset={10}
                hideArrow
                className="max-w-64 rounded-lg border border-sidebar-border bg-popover px-3 py-2 text-popover-foreground shadow-sm"
            >
                <TooltipBody label={label} description={description} />
            </TooltipContent>
        </Tooltip>
    );
}

function TooltipBody({
    label,
    description,
}: {
    label: string;
    description?: string;
}): ReactNode {
    return (
        <span className="block">
            <span className="block text-sm font-semibold leading-5">{label}</span>
            {description ? (
                <span className="mt-0.5 block max-w-[22ch] text-xs leading-5 text-muted-foreground">
                    {description}
                </span>
            ) : null}
        </span>
    );
}
