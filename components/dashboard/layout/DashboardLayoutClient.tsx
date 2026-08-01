"use client";

import {
    useEffect,
    useRef,
    useState,
    type ReactElement,
    type ReactNode,
} from "react";
import { DashboardSidebar } from "@/components/dashboard/layout/DashboardSidebar";
import { DashboardNavbar } from "@/components/dashboard/layout/DashboardNavbar";
import { useDashboardContext } from "@/components/dashboard/context";
import { getDashboardPageLabel } from "@/constants/dashboard";

export function DashboardLayoutClient({
    children,
}: {
    children: ReactNode;
}): ReactElement {
    const { status, selectedMenu } = useDashboardContext();
    const mainRef = useRef<HTMLElement>(null);
    const lastHandledMenuRef = useRef(selectedMenu);
    const [pageAnnouncement, setPageAnnouncement] = useState("");

    useEffect(() => {
        if (
            status !== "authenticated" ||
            lastHandledMenuRef.current === selectedMenu
        ) {
            return;
        }

        const main = mainRef.current;
        if (!main) {
            return;
        }

        lastHandledMenuRef.current = selectedMenu;
        main.scrollTo({ top: 0, left: 0, behavior: "auto" });
        setPageAnnouncement(
            `เปิดหน้า ${getDashboardPageLabel(selectedMenu)} แล้ว`,
        );

        const focusPageHeading = (): boolean => {
            const heading = main.querySelector<HTMLElement>(
                "[data-page-heading]",
            );
            if (!heading) {
                return false;
            }

            heading.focus({ preventScroll: true });
            return true;
        };

        if (focusPageHeading()) {
            return;
        }

        const observer = new MutationObserver(() => {
            if (focusPageHeading()) {
                observer.disconnect();
            }
        });
        observer.observe(main, { childList: true, subtree: true });

        return () => {
            observer.disconnect();
        };
    }, [selectedMenu, status]);

    if (status === "loading") {
        return (
            <div className="app-shell-background flex h-dvh">
                {/* Sidebar Skeleton */}
                <div className="hidden h-full w-64 flex-col border-r border-border-neutral bg-surface-raised p-4 shadow-lg lg:flex 2xl:w-72">
                    <div className="mb-6 h-8 rounded-lg bg-surface-muted animate-pulse" />
                    <div className="space-y-3 flex-1">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div
                                key={i}
                                className="h-10 rounded-xl bg-surface-neutral-muted animate-pulse"
                            />
                        ))}
                    </div>
                    <div className="mt-4 h-20 rounded-xl bg-surface-neutral-muted animate-pulse" />
                </div>

                {/* Main Content Skeleton */}
                <div className="flex-1 flex items-center justify-center">
                    <div className="animate-pulse space-y-4">
                        <div className="mx-auto h-8 w-48 rounded bg-surface-muted" />
                        <div className="mx-auto h-4 w-64 rounded bg-surface-muted" />
                        <div className="mx-auto mt-8 h-32 w-96 rounded bg-surface-muted" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="app-shell-background flex h-dvh">
            {/* Desktop Sidebar */}
            <div className="hidden h-full flex-shrink-0 lg:block">
                <DashboardSidebar variant="desktop" />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
            {/* Background Effects - Optimized with contain */}
                <div 
                    className="absolute inset-0 overflow-hidden pointer-events-none contain-paint"
                    style={{ willChange: 'transform' }}
                >
                    <div 
                        className="dashboard-glow-info absolute top-0 right-0 h-[400px] w-[400px] rounded-full"
                        style={{ filter: 'blur(80px)' }}
                    />
                    <div 
                        className="dashboard-glow-accent absolute bottom-0 left-0 h-[400px] w-[400px] rounded-full"
                        style={{ filter: 'blur(80px)' }}
                    />
                </div>

                {/* Navbar */}
                <DashboardNavbar />

                <p
                    className="sr-only"
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                >
                    {pageAnnouncement}
                </p>

                {/* Page Content */}
                <main
                    ref={mainRef}
                    id="main"
                    className="relative z-10 min-w-0 flex-1 overflow-y-auto py-4 pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))] lg:p-6 2xl:p-8"
                >
                    {children}
                </main>
            </div>
        </div>
    );
}
