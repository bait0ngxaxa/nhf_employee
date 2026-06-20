"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

import { useDashboardUIContext } from "@/components/dashboard/context/dashboard/DashboardContext";
import { SectionSkeleton } from "@/components/dashboard/SectionSkeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SessionManagementView } from "./session-management/SessionManagementView";
import { useSessionManagement } from "./session-management/useSessionManagement";

function SessionLoadingState() {
    return <SectionSkeleton />;
}

function SessionErrorState({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="min-h-[calc(100vh-6rem)] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
            <div className="p-4 md:p-8">
                <Card className="rounded-2xl border-red-200 bg-white shadow-sm">
                    <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 gap-3">
                            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                            <div className="min-w-0 space-y-1">
                                <p className="font-semibold text-red-800">
                                    โหลดข้อมูลเซสชันไม่สำเร็จ
                                </p>
                                <p className="text-sm leading-6 text-red-700 [overflow-wrap:anywhere]">
                                    กรุณาลองใหม่อีกครั้ง หากยังไม่สำเร็จให้เข้าสู่ระบบใหม่
                                </p>
                            </div>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            className="h-10 shrink-0 border-red-200 text-red-700 hover:bg-red-50"
                            onClick={onRetry}
                        >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            โหลดใหม่
                        </Button>
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
        return (
            <SessionErrorState
                onRetry={() => {
                    void refresh();
                }}
            />
        );
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
