import { Loader2, Monitor, ShieldCheck, Smartphone, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    formatDateTime,
    formatRelativeTime,
    getConfirmTexts,
    getDeviceTypeLabel,
    parseUserAgent,
} from "./sessionManagement.utils";
import type { ConfirmAction, SessionItem } from "./types";

interface SessionManagementViewProps {
    sessions: SessionItem[];
    currentSession: SessionItem | null;
    revokingId: string | null;
    isRevokingOthers: boolean;
    isValidating: boolean;
    confirmAction: ConfirmAction | null;
    onSetConfirmAction: (action: ConfirmAction | null) => void;
    onRefresh: () => void;
    onConfirmAction: () => void;
}

function SessionCard({
    session,
    isRevoking,
    isValidating,
    onRequestRevoke,
}: {
    session: SessionItem;
    isRevoking: boolean;
    isValidating: boolean;
    onRequestRevoke: (sessionId: string) => void;
}) {
    const parsed = parseUserAgent(session.userAgent);
    const lastActive = session.lastUsedAt ?? session.createdAt;

    return (
        <div
            className={cn(
                "rounded-xl border bg-white p-4 shadow-sm",
                session.isCurrent ? "border-cyan-200 ring-1 ring-cyan-100" : "border-gray-200",
            )}
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        {parsed.deviceType === "mobile" ? (
                            <Smartphone className="h-4 w-4 text-cyan-600" />
                        ) : (
                            <Monitor className="h-4 w-4 text-cyan-600" />
                        )}
                        <span className="text-sm font-semibold text-gray-900">{parsed.browser}</span>
                        <span className="text-xs text-gray-400">|</span>
                        <span className="text-sm text-gray-600">{parsed.os}</span>
                        {session.isCurrent ? (
                            <Badge className="bg-cyan-100 text-cyan-700 hover:bg-cyan-100">
                                อุปกรณ์นี้
                            </Badge>
                        ) : null}
                    </div>
                    <p className="text-xs text-gray-400">{getDeviceTypeLabel(parsed.deviceType)}</p>
                    <div className="grid gap-1 text-xs text-gray-500 sm:grid-cols-2">
                        <span>IP: {session.ipAddress ?? "ไม่ทราบ"}</span>
                        <span>เริ่มใช้งาน: {formatDateTime(session.createdAt)}</span>
                        <span>ใช้งานล่าสุด: {formatRelativeTime(lastActive)}</span>
                        <span>หมดอายุ: {formatDateTime(session.expiresAt)}</span>
                    </div>
                </div>
                {!session.isCurrent ? (
                    <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => onRequestRevoke(session.id)}
                        disabled={isRevoking || isValidating}
                    >
                        {isRevoking ? (
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
}

export function SessionManagementView({
    sessions,
    currentSession,
    revokingId,
    isRevokingOthers,
    isValidating,
    confirmAction,
    onSetConfirmAction,
    onRefresh,
    onConfirmAction,
}: SessionManagementViewProps) {
    const otherSessionCount = sessions.filter((session) => !session.isCurrent).length;
    const { title, description } = getConfirmTexts(confirmAction);

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
                            onClick={() => onSetConfirmAction({ type: "signout-others" })}
                            disabled={isRevokingOthers || otherSessionCount === 0}
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
                            onClick={() => onSetConfirmAction({ type: "signout-current" })}
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
                                    {sessions.map((session) => (
                                        <SessionCard
                                            key={session.id}
                                            session={session}
                                            isRevoking={revokingId === session.id}
                                            isValidating={isValidating}
                                            onRequestRevoke={(sessionId) =>
                                                onSetConfirmAction({ type: "revoke-session", sessionId })
                                            }
                                        />
                                    ))}
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
                                        onClick={onRefresh}
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

            <Dialog open={Boolean(confirmAction)} onOpenChange={(open) => !open && onSetConfirmAction(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                        <DialogDescription>{description}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex gap-2 sm:justify-end">
                        <Button variant="outline" onClick={() => onSetConfirmAction(null)}>
                            ยกเลิก
                        </Button>
                        <Button variant="destructive" onClick={onConfirmAction}>
                            ยืนยัน
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
