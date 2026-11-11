import { cn } from "@/lib/ui/utils";

/** Visual grammar only. Dashboard and LIFF own their routes, eligibility and scroll models. */
export function mobileNavigationItemClassName(active: boolean): string {
    return cn(
        "relative flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1 text-xs font-semibold leading-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-focus active:bg-brand-surface",
        active ? "bg-brand-surface text-brand-foreground" : "text-content-muted hover:bg-surface-subtle hover:text-content-body",
    );
}
