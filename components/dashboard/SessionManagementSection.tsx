"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import { Loader2, Monitor, ShieldCheck, Smartphone, Trash2 } from "lucide-react";

import { apiGet, apiPost } from "@/lib/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useDashboardUIContext } from "@/components/dashboard/context/dashboard/DashboardContext";

interface SessionItem {
    id: string;
    familyId: string;
    createdAt: string;
    lastUsedAt: string | null;
    expiresAt: string;
    userAgent: string | null;
    ipAddress: string | null;
    isCurrent: boolean;
}

interface SessionsResponse {
    sessions: SessionItem[];
}

type ConfirmAction =
    | { type: "revoke-session"; sessionId: string }
    | { type: "signout-current" }
    | { type: "signout-others" };

const fetchSessions = async (): Promise<SessionsResponse> => {
    const result = await apiGet<SessionsResponse>(API_ROUTES.auth.sessions);
    if (!result.success) {
        throw new Error(result.error);
    }
    return result.data;
};

function formatDateTime(value: string | null): string {
    if (!value) {
        return "ไม่เคยใช้งาน";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "ไม่ทราบเวลา";
    }

    return new Intl.DateTimeFormat("th-TH", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

function getDeviceLabel(userAgent: string | null): string {
    if (!userAgent) {
        return "อุปกรณ์ไม่ทราบประเภท";
    }

    const normalized = userAgent.toLowerCase();
    if (normalized.includes("iphone") || normalized.includes("android") || normalized.includes("mobile")) {
        return "มือถือ";
    }
    if (normalized.includes("ipad") || normalized.includes("tablet")) {
        return "แท็บเล็ต";
    }
    return "คอมพิวเตอร์";
}

export function SessionManagementSection() {
    const { handleSignOut } = useDashboardUIContext();
    const [revokingId, setRevokingId] = useState<string | null>(null);
    const [isRevokingOthers, setIsRevokingOthers] = useState(false);
    const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

    const { data, error, isLoading, isValidating, mutate } = useSWR<SessionsResponse>(
        API_ROUTES.auth.sessions,
        fetchSessions,
    );

    const sessions = data?.sessions ?? [];
    const currentSession = sessions.find((session) => session.isCurrent) ?? null;
    const otherSessions = sessions.filter((session) => !session.isCurrent);

    const handleRevokeSession = async (sessionId: string): Promise<void> => {
        setRevokingId(sessionId);
        try {
            const result = await apiPost<{ success: true }>(
                API_ROUTES.auth.revokeSession,
                { sessionId },
            );

            if (!result.success) {
                throw new Error(result.error);
            }

            toast.success("ยกเลิกเซสชันเรียบร้อย");
            await mutate();
        } catch (revokeError) {
            const message = revokeError instanceof Error ? revokeError.message : "ไม่สามารถยกเลิกเซสชันได้";
            toast.error(message);
        } finally {
            setRevokingId(null);
        }
    };

    const handleRevokeOtherSessions = async (): Promise<void> => {
        if (otherSessions.length === 0) {
            toast.info("ไม่มีเซสชันอื่นที่กำลังใช้งาน");
            return;
        }

        setIsRevokingOthers(true);
        try {
            const revokeResults = await Promise.all(
                otherSessions.map((session) =>
                    apiPost<{ success: true }>(
                        API_ROUTES.auth.revokeSession,
                        { sessionId: session.id },
                    ),
                ),
            );

            const failedCount = revokeResults.filter((result) => !result.success).length;
            if (failedCount > 0) {
                toast.error(`ยกเลิกเซสชันล้มเหลว ${failedCount} รายการ`);
            } else {
                toast.success("ออกจากระบบอุปกรณ์อื่นทั้งหมดแล้ว");
            }

            await mutate();
        } catch {
            toast.error("ไม่สามารถออกจากระบบอุปกรณ์อื่นได้");
        } finally {
            setIsRevokingOthers(false);
        }
    };

    const handleConfirmAction = async (): Promise<void> => {
        if (!confirmAction) {
            return;
        }

        if (confirmAction.type === "revoke-session") {
            setConfirmAction(null);
            await handleRevokeSession(confirmAction.sessionId);
            return;
        }

        if (confirmAction.type === "signout-current") {
            setConfirmAction(null);
            handleSignOut();
            return;
        }

        setConfirmAction(null);
        await handleRevokeOtherSessions();
    };

    const confirmTitle =
        confirmAction?.type === "revoke-session"
            ? "ยืนยันยกเลิกเซสชันนี้?"
            : confirmAction?.type === "signout-current"
              ? "ยืนยันออกจากระบบอุปกรณ์นี้?"
              : "ยืนยันออกจากระบบอุปกรณ์อื่น?";

    const confirmDescription =
        confirmAction?.type === "revoke-session"
            ? "อุปกรณ์นี้จะต้องเข้าสู่ระบบใหม่อีกครั้ง"
            : confirmAction?.type === "signout-current"
              ? "เซสชันปัจจุบันของคุณจะสิ้นสุดทันที"
              : "ระบบจะออกจากระบบทุกอุปกรณ์อื่นที่ยังใช้งานอยู่";

    if (isLoading) {
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

    if (error) {
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

    return (
        <div className="relative min-h-[calc(100vh-6rem)] bg-slate-50/50 rounded-3xl overflow-hidden border border-white/60 shadow-inner">
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[radial-gradient(circle_at_center,rgba(207,250,254,0.6)_0%,transparent_70%)] -translate-y-1/2 translate-x-1/3" />
                <div className="absolute bottom-0 left-0 w-[1000px] h-[1000px] bg-[radial-gradient(circle_at_center,rgba(224,242,254,0.6)_0%,transparent_70%)] translate-y-1/3 -translate-x-1/4" />
            </div>

            <div className="relative z-10 p-4 md:p-8 space-y-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-in fade-in slide-in-from-bottom-2 duration-700 ease-out">
                    <div className="flex items-center space-x-5">
                        <div className="relative group cursor-default">
                            <div className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-cyan-500/40 to-teal-500/40 blur-xl opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-[opacity,transform] duration-500 will-change-transform" />
                            <div className="relative flex items-center justify-center w-14 h-14 bg-gradient-to-br from-cyan-600 to-teal-700 rounded-2xl shadow-lg shadow-cyan-500/25 ring-1 ring-white/20">
                                <ShieldCheck className="h-7 w-7 text-white" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-gray-900 via-gray-800 to-gray-600 pb-1">
                                จัดการเซสชัน
                            </h2>
                            <p className="text-gray-500 font-medium">
                                ตรวจสอบอุปกรณ์ที่กำลังใช้งาน และยกเลิกการเข้าถึงได้ทันที
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            variant="outline"
                            onClick={() => setConfirmAction({ type: "signout-others" })}
                            disabled={isRevokingOthers || otherSessions.length === 0}
                            className="bg-white/95 hover:bg-gray-50 text-gray-700 border-gray-200 shadow-sm rounded-xl"
                        >
                            {isRevokingOthers ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Trash2 className="mr-2 h-4 w-4" />
                            )}
                            ออกจากระบบอุปกรณ์อื่น
                        </Button>
                        <Button
                            onClick={() => setConfirmAction({ type: "signout-current" })}
                            className="bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700 text-white shadow-md shadow-cyan-500/25 transition-[transform,background-color,box-shadow] duration-300 hover:shadow-lg motion-safe:hover:-translate-y-0.5 rounded-xl"
                        >
                            ออกจากระบบอุปกรณ์นี้
                        </Button>
                    </div>
                </div>

                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-700 ease-out delay-150">
                    <div className="bg-white/95 rounded-2xl shadow-lg ring-1 ring-gray-200 p-1">
                        <Card className="border-0 shadow-none bg-transparent">
                            <CardHeader className="border-b border-gray-100 bg-gray-50/50 px-6 py-5 rounded-t-2xl">
                                <CardTitle className="text-xl font-bold tracking-tight text-gray-900">
                                    เซสชันที่ใช้งานอยู่ <span className="text-cyan-700">{sessions.length}</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 sm:p-6 space-y-4">
                                <div className="space-y-3">
                                    {sessions.map((session) => {
                                        const isRevokingThis = revokingId === session.id;
                                        return (
                                            <div
                                                key={session.id}
                                                className={cn(
                                                    "rounded-xl border bg-white p-4 shadow-sm",
                                                    session.isCurrent ? "border-cyan-200 ring-1 ring-cyan-100" : "border-gray-200",
                                                )}
                                            >
                                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-2">
                                                            {getDeviceLabel(session.userAgent) === "มือถือ" ? (
                                                                <Smartphone className="h-4 w-4 text-cyan-600" />
                                                            ) : (
                                                                <Monitor className="h-4 w-4 text-cyan-600" />
                                                            )}
                                                            <span className="text-sm font-medium text-gray-900">
                                                                {getDeviceLabel(session.userAgent)}
                                                            </span>
                                                            {session.isCurrent ? (
                                                                <Badge className="bg-cyan-100 text-cyan-700 hover:bg-cyan-100">
                                                                    อุปกรณ์นี้
                                                                </Badge>
                                                            ) : null}
                                                        </div>
                                                        <p className="text-xs text-gray-500 break-all">
                                                            {session.userAgent ?? "ไม่พบข้อมูลเบราว์เซอร์"}
                                                        </p>
                                                        <div className="grid gap-1 text-xs text-gray-500 sm:grid-cols-2">
                                                            <span>IP: {session.ipAddress ?? "ไม่ทราบ"}</span>
                                                            <span>เริ่มใช้งาน: {formatDateTime(session.createdAt)}</span>
                                                            <span>ใช้งานล่าสุด: {formatDateTime(session.lastUsedAt)}</span>
                                                            <span>หมดอายุ: {formatDateTime(session.expiresAt)}</span>
                                                        </div>
                                                    </div>
                                                    {!session.isCurrent ? (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="rounded-xl"
                                                            onClick={() => {
                                                                setConfirmAction({
                                                                    type: "revoke-session",
                                                                    sessionId: session.id,
                                                                });
                                                            }}
                                                            disabled={isRevokingThis || isValidating}
                                                        >
                                                            {isRevokingThis ? (
                                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                            )}
                                                            ยกเลิกเซสชัน
                                                        </Button>
                                                    ) : null}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                {sessions.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
                                        ไม่พบเซสชันที่กำลังใช้งาน
                                    </div>
                                ) : null}
                                <div className="flex justify-end">
                                    <Button
                                        variant="ghost"
                                        className="rounded-xl"
                                        onClick={() => {
                                            void mutate();
                                        }}
                                        disabled={isValidating}
                                    >
                                        {isValidating ? (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        ) : null}
                                        รีเฟรช
                                    </Button>
                                </div>
                                {currentSession ? (
                                    <p className="text-xs text-gray-400">
                                        รหัสเซสชันปัจจุบัน: {currentSession.familyId}
                                    </p>
                                ) : null}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>

            <Dialog open={Boolean(confirmAction)} onOpenChange={(open) => !open && setConfirmAction(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{confirmTitle}</DialogTitle>
                        <DialogDescription>{confirmDescription}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex gap-2 sm:justify-end">
                        <Button variant="outline" onClick={() => setConfirmAction(null)}>
                            ยกเลิก
                        </Button>
                        <Button variant="destructive" onClick={() => void handleConfirmAction()}>
                            ยืนยัน
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
