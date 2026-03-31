"use client";

import { Loader2 } from "lucide-react";

import { useDashboardUIContext } from "@/components/dashboard/context/dashboard/DashboardContext";
import { Card, CardContent } from "@/components/ui/card";
import { SessionManagementView } from "./session-management/SessionManagementView";
import { useSessionManagement } from "./session-management/useSessionManagement";

function SessionLoadingState() {
    return (
        <div className="relative min-h-[calc(100vh-6rem)] bg-slate-50/50 rounded-3xl overflow-hidden border border-white/60 shadow-inner">
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[radial-gradient(circle_at_center,rgba(207,250,254,0.6)_0%,transparent_70%)] -translate-y-1/2 translate-x-1/3" />
                <div className="absolute bottom-0 left-0 w-[1000px] h-[1000px] bg-[radial-gradient(circle_at_center,rgba(224,242,254,0.6)_0%,transparent_70%)] translate-y-1/3 -translate-x-1/4" />
            </div>
            <div className="relative z-10 flex min-h-[320px] items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
            </div>
        </div>
    );
}

function SessionErrorState() {
    return (
        <div className="relative min-h-[calc(100vh-6rem)] bg-slate-50/50 rounded-3xl overflow-hidden border border-white/60 shadow-inner">
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[radial-gradient(circle_at_center,rgba(254,226,226,0.7)_0%,transparent_70%)] -translate-y-1/2 translate-x-1/3" />
            </div>
            <div className="relative z-10 p-4 md:p-8">
                <Card className="rounded-2xl border-red-100 bg-red-50/30">
                    <CardContent className="p-6 text-sm text-red-700">
                        โหลดข้อมูลเซสชันไม่สำเร็จ กรุณาลองใหม่อีกครั้ง
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export function SessionManagementSection() {
    const { handleSignOut } = useDashboardUIContext();
    const {
        sessions,
        currentSession,
        error,
        isLoading,
        isValidating,
        revokingId,
        isRevokingOthers,
        confirmAction,
        setConfirmAction,
        refresh,
        handleConfirmAction,
    } = useSessionManagement({ onSignOutCurrent: handleSignOut });

    if (isLoading) {
        return <SessionLoadingState />;
    }

    if (error) {
        return <SessionErrorState />;
    }

    return (
        <SessionManagementView
            sessions={sessions}
            currentSession={currentSession}
            revokingId={revokingId}
            isRevokingOthers={isRevokingOthers}
            isValidating={isValidating}
            confirmAction={confirmAction}
            onSetConfirmAction={setConfirmAction}
            onRefresh={() => {
                void refresh();
            }}
            onConfirmAction={() => {
                void handleConfirmAction();
            }}
        />
    );
}
