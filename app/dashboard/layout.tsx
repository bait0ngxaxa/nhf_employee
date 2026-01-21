"use client";

import { useEffect } from "react";
import {
    DashboardProvider,
    useDashboardContext,
} from "@/components/dashboard/context";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DashboardNavbar } from "@/components/dashboard/DashboardNavbar";

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
    const {
        status,
        user,
        sidebarOpen,
        setSidebarOpen,
        selectedMenu,
        handleMenuClick,
        availableMenuItems,
        handleSignOut,
        router,
    } = useDashboardContext();

    useEffect(() => {
        if (status === "unauthenticated") {
            router.push("/login");
        }
    }, [status, router]);

    if (status === "loading") {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
        );
    }

    if (status === "unauthenticated") {
        return null;
    }

    return (
        <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-10 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div
                className={`
                    fixed md:relative inset-y-0 left-0 z-20 h-full flex-shrink-0
                    transform transition-transform duration-300 ease-in-out
                    ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
                `}
            >
                <DashboardSidebar
                    isOpen={sidebarOpen}
                    onToggle={() => setSidebarOpen(!sidebarOpen)}
                    selectedMenu={selectedMenu}
                    onMenuClick={handleMenuClick}
                    menuItems={availableMenuItems}
                    user={user}
                    onSignOut={handleSignOut}
                />
            </div>

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
                {/* Background Effects */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-200/30 rounded-full blur-3xl" />
                    <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-purple-200/30 rounded-full blur-3xl" />
                </div>

                {/* Navbar */}
                <DashboardNavbar />

                {/* Page Content */}
                <main className="flex-1 overflow-y-auto p-4 md:p-8 relative z-10">
                    {children}
                </main>
            </div>
        </div>
    );
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <DashboardProvider>
            <DashboardLayoutContent>{children}</DashboardLayoutContent>
        </DashboardProvider>
    );
}
