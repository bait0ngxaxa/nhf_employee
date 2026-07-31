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
            <div className="flex h-dvh bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
                {/* Sidebar Skeleton */}
                <div className="hidden h-full w-64 flex-col border-r border-gray-200/50 bg-white p-4 shadow-lg lg:flex 2xl:w-72">
                    <div className="h-8 bg-gray-200 rounded-lg animate-pulse mb-6" />
                    <div className="space-y-3 flex-1">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div
                                key={i}
                                className="h-10 bg-gray-100 rounded-xl animate-pulse"
                            />
                        ))}
                    </div>
                    <div className="h-20 bg-gray-100 rounded-xl animate-pulse mt-4" />
                </div>

                {/* Main Content Skeleton */}
                <div className="flex-1 flex items-center justify-center">
                    <div className="animate-pulse space-y-4">
                        <div className="h-8 bg-gray-200 rounded w-48 mx-auto" />
                        <div className="h-4 bg-gray-200 rounded w-64 mx-auto" />
                        <div className="h-32 bg-gray-200 rounded w-96 mx-auto mt-8" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-dvh bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
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
                        className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-200/20 rounded-full" 
                        style={{ filter: 'blur(80px)' }}
                    />
                    <div 
                        className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-200/20 rounded-full" 
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
