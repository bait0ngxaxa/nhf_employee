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
import { DashboardShellSkeleton } from "@/components/dashboard/feedback/DashboardShellSkeleton";
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
        return <DashboardShellSkeleton />;
    }

    return (
        <div className="app-shell-background flex h-dvh min-h-0">
            {/* Desktop Sidebar */}
            <div className="hidden h-full flex-shrink-0 lg:block">
                <DashboardSidebar variant="desktop" />
            </div>

            {/* Main Content Area */}
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
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
                    className="relative z-10 min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))] lg:p-6 lg:pb-[calc(1.5rem+env(safe-area-inset-bottom))] 2xl:p-8 2xl:pb-[calc(2rem+env(safe-area-inset-bottom))]"
                >
                    {children}
                </main>
            </div>
        </div>
    );
}
