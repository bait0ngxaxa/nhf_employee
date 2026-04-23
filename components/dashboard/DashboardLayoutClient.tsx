"use client";

import { useDashboardUIContext } from "@/components/dashboard/context/dashboard/DashboardContext";
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar";
import { DashboardNavbar } from "@/components/dashboard/DashboardNavbar";
import { useDashboardContext } from "@/components/dashboard/context";

export function DashboardLayoutClient({
    children,
}: {
    children: React.ReactNode;
}) {
    const { sidebarOpen, setSidebarOpen } = useDashboardUIContext();

    const { status } = useDashboardContext();

    if (status === "loading") {
        return (
            <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
                {/* Sidebar Skeleton */}
                <div className="w-64 bg-white shadow-lg border-r border-gray-200/50 p-4 hidden md:flex flex-col h-full">
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
        <div className="flex h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div
                className={`
                    fixed inset-y-0 left-0 z-40 h-full flex-shrink-0 md:relative md:z-20
                    transform transition-transform duration-300 ease-in-out
                    ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
                `}
            >
                <DashboardSidebar />
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

                {/* Page Content */}
                <main id="main" className="flex-1 overflow-y-auto p-4 md:p-8 relative z-10">
                    {children}
                </main>
            </div>
        </div>
    );
}
