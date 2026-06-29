import type React from "react";
import {
    Clock3,
    Loader2,
    Monitor,
    RefreshCw,
    ShieldCheck,
    Smartphone,
    Trash2,
} from "lucide-react";

import { cn } from "@/lib/ui/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

function SessionRow({
    session,
    isRevoking,
    isValidating,
    onRequestRevoke,
}: {
    session: SessionItem;
    isRevoking: boolean;
    isValidating: boolean;
    onRequestRevoke: (sessionId: string) => void;
}): React.ReactElement {
    const parsed = parseUserAgent(session.userAgent);
    const lastActive = session.lastUsedAt ?? session.createdAt;
    const DeviceIcon = parsed.deviceType === "mobile" ? Smartphone : Monitor;

    return (
        <li className={cn(
            "grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_10rem] sm:items-start",
            session.isCurrent && "bg-cyan-50/60",
        )}>
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                        <DeviceIcon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-semibold text-slate-950">
                        {parsed.browser}
                    </span>
                    <span className="text-sm text-slate-600">{parsed.os}</span>
                    {session.isCurrent ? (
                        <Badge className="bg-cyan-100 text-cyan-800 hover:bg-cyan-100">
                            อุปกรณ์นี้
                        </Badge>
                    ) : null}
                </div>
                <p className="mt-2 text-xs font-medium text-slate-500">
                    {getDeviceTypeLabel(parsed.deviceType)}
                </p>
                <dl className="mt-3 grid gap-x-6 gap-y-2 text-xs leading-5 text-slate-600 lg:grid-cols-2 2xl:grid-cols-4">
                    <SessionDetail label="IP" value={session.ipAddress ?? "ไม่ทราบ"} />
                    <SessionDetail label="เริ่มใช้งาน" value={formatDateTime(session.createdAt)} />
                    <SessionDetail label="ใช้งานล่าสุด" value={formatRelativeTime(lastActive)} />
                    <SessionDetail label="หมดอายุ" value={formatDateTime(session.expiresAt)} />
                </dl>
            </div>
            <div className="flex min-w-0 sm:justify-end">
                {!session.isCurrent ? (
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-10 w-full border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                        onClick={() => onRequestRevoke(session.id)}
                        disabled={isRevoking || isValidating}
                        aria-label={`ยกเลิกเซสชัน ${parsed.browser} ${parsed.os}`}
                    >
                        {isRevoking ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                        )}
                        ยกเลิกเซสชัน
                    </Button>
                ) : null}
            </div>
        </li>
    );
}

function SessionDetail({
    label,
    value,
}: {
    label: string;
    value: string;
}): React.ReactElement {
    return (
        <div className="min-w-0">
            <dt className="text-slate-500">{label}</dt>
            <dd className="font-medium text-slate-700 [overflow-wrap:anywhere]">{value}</dd>
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
}: SessionManagementViewProps): React.ReactElement {
    const otherSessionCount = sessions.filter((session) => !session.isCurrent).length;
    const { title, description } = getConfirmTexts(confirmAction);
    const isConfirming = Boolean(revokingId) || isRevokingOthers;

    return (
        <section className="min-h-[calc(100vh-6rem)] bg-slate-50 px-4 py-6 md:px-8 md:py-8">
            <div className="mx-auto max-w-6xl space-y-5">
                <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-100 text-cyan-700">
                            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-2xl font-bold tracking-tight text-slate-950">
                                จัดการเซสชัน
                            </h2>
                            <p className="mt-0.5 text-sm text-slate-600">
                                ตรวจสอบอุปกรณ์ที่กำลังเข้าถึงบัญชีของคุณ
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                            variant="outline"
                            onClick={() => onSetConfirmAction({ type: "signout-others" })}
                            disabled={isRevokingOthers || otherSessionCount === 0}
                            className="h-10 border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        >
                            {isRevokingOthers ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : (
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                            )}
                            ออกจากอุปกรณ์อื่น
                        </Button>
                        <Button
                            onClick={() => onSetConfirmAction({ type: "signout-current" })}
                            className="h-10 bg-cyan-700 text-white hover:bg-cyan-800"
                        >
                            ออกจากอุปกรณ์นี้
                        </Button>
                    </div>
                </header>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h3 className="font-semibold text-slate-950">
                                อุปกรณ์ที่กำลังใช้งาน <span className="text-cyan-700">{sessions.length}</span>
                            </h3>
                            <p className="mt-0.5 text-sm text-slate-600">
                                เลือกยกเลิกอุปกรณ์ที่คุณไม่รู้จักได้ทันที
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 self-start text-slate-700 hover:bg-slate-100 sm:self-auto"
                            onClick={onRefresh}
                            disabled={isValidating}
                        >
                            {isValidating ? (
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : (
                                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                            )}
                            รีเฟรช
                        </Button>
                    </div>
                    {sessions.length > 0 ? (
                        <ul className="divide-y divide-slate-100">
                            {sessions.map((session) => (
                                <SessionRow
                                    key={session.id}
                                    session={session}
                                    isRevoking={revokingId === session.id}
                                    isValidating={isValidating}
                                    onRequestRevoke={(sessionId) => onSetConfirmAction({ type: "revoke-session", sessionId })}
                                />
                            ))}
                        </ul>
                    ) : (
                        <div className="px-5 py-12 text-center">
                            <Clock3 className="mx-auto h-5 w-5 text-slate-400" aria-hidden="true" />
                            <p className="mt-3 text-sm font-semibold text-slate-900">ไม่พบเซสชันที่กำลังใช้งาน</p>
                            <p className="mt-1 text-sm text-slate-600">ลองโหลดข้อมูลใหม่อีกครั้ง</p>
                        </div>
                    )}
                    {currentSession ? (
                        <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500 [overflow-wrap:anywhere]">
                            รหัสเซสชันปัจจุบัน: {currentSession.familyId}
                        </div>
                    ) : null}
                </div>
            </div>

            <Dialog open={Boolean(confirmAction)} onOpenChange={(open) => !open && onSetConfirmAction(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="[overflow-wrap:anywhere]">{title}</DialogTitle>
                        <DialogDescription className="[overflow-wrap:anywhere]">{description}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex gap-2 sm:justify-end">
                        <Button variant="outline" onClick={() => onSetConfirmAction(null)} disabled={isConfirming}>
                            ยกเลิก
                        </Button>
                        <Button variant="destructive" onClick={onConfirmAction} disabled={isConfirming}>
                            {isConfirming ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                            ยืนยัน
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}
