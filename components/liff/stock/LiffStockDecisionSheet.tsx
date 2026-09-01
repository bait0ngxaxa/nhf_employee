"use client";

import { Loader2, PackageCheck, ShieldAlert } from "lucide-react";
import { useEffect, useState, type ReactElement } from "react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type {
    LiffStockRequestAction,
    LiffStockRequestSummary,
} from "@/lib/types/stock-liff";

export interface LiffStockDecisionIntent {
    action: LiffStockRequestAction;
    request: LiffStockRequestSummary;
    actorMode: "employee" | "processor";
}

interface LiffStockDecisionSheetProps {
    intent: LiffStockDecisionIntent | null;
    busy: boolean;
    error: string | null;
    onOpenChange: (open: boolean) => void;
    onConfirm: (reason?: string) => void;
}

export function LiffStockDecisionSheet({
    intent,
    busy,
    error,
    onOpenChange,
    onConfirm,
}: LiffStockDecisionSheetProps): ReactElement | null {
    const [reason, setReason] = useState("");

    useEffect(() => {
        if (intent) setReason("");
    }, [intent]);

    if (!intent) return null;

    const issuing = intent.action === "ISSUE";
    const processorCancellation = intent.actorMode === "processor" && !issuing;
    const actionAvailable = intent.request.availableActions.includes(intent.action);
    const title = issuing
        ? "ยืนยันจ่ายวัสดุ"
        : processorCancellation
            ? "ยืนยันไม่ดำเนินการ"
            : "ยืนยันยกเลิกคำขอ";
    const confirmationLabel = busy
        ? "กำลังดำเนินการ..."
        : issuing
            ? "ยืนยันจ่ายวัสดุ"
            : processorCancellation
                ? "ยืนยันไม่ดำเนินการ"
                : "ยืนยันยกเลิกคำขอ";

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!busy) onOpenChange(open);
            }}
        >
            <DialogContent
                closeLabel="ปิดหน้าต่างยืนยัน"
                scrollMode="content"
                className="bottom-0 left-0 top-auto max-h-[88vh] supports-[height:100dvh]:max-h-[88dvh] max-w-none translate-x-0 translate-y-0 gap-0 scroll-pb-28 rounded-b-none rounded-t-xl border-x-0 border-b-0 p-0 sm:left-1/2 sm:max-w-lg sm:-translate-x-1/2"
                aria-busy={busy}
            >
                <div className={`sticky top-0 z-20 border-b px-4 py-4 pr-12 ${
                    issuing
                        ? "border-status-success-border bg-status-success-surface"
                        : "border-status-danger-border bg-status-danger-surface"
                }`}>
                    <DialogTitle className="flex items-center gap-2 text-lg leading-7 text-content-heading">
                        {issuing ? (
                            <PackageCheck className="size-5 text-status-success-icon" aria-hidden="true" />
                        ) : (
                            <ShieldAlert className="size-5 text-status-danger-icon" aria-hidden="true" />
                        )}
                        {title}
                    </DialogTitle>
                    <DialogDescription className="mt-1 leading-6 text-content-secondary">
                        คำขอ #{intent.request.id} · {intent.request.projectCode}
                    </DialogDescription>
                </div>

                <div className="space-y-4 px-4 py-4">
                    <p className="rounded-2xl bg-surface-subtle px-4 py-3 text-sm font-semibold leading-6 text-content-strong">
                        {!actionAvailable
                            ? "สถานะคำขอเปลี่ยนแปลงแล้ว ไม่สามารถดำเนินการนี้ได้ กรุณาปิดหน้าต่างเพื่อตรวจสอบรายละเอียดล่าสุด"
                            : issuing
                            ? "เมื่อยืนยัน สต็อกจะถูกตัดตามรายการนี้ทันที"
                            : "เมื่อยืนยัน คำขอนี้จะถูกยกเลิกและไม่สามารถจ่ายวัสดุจากคำขอเดิมได้"}
                    </p>
                    {intent.request.requester ? (
                        <p className="text-sm text-content-secondary">
                            ผู้เบิก: <span className="font-semibold text-content-strong">{intent.request.requester.name}</span>
                        </p>
                    ) : null}
                    <div className="space-y-2">
                        {intent.request.items.map((item, index) => (
                            <div
                                key={`${item.itemSku}-${item.variantSku ?? "default"}-${index}`}
                                className="flex items-start justify-between gap-3 rounded-xl bg-surface-subtle px-3 py-2.5"
                            >
                                <div className="min-w-0">
                                    <p className="break-words text-sm font-semibold leading-6 text-content-strong">
                                        {item.itemName}
                                    </p>
                                    <p className="break-words text-xs leading-5 text-content-muted">
                                        {item.variantLabel || item.variantSku || item.itemSku}
                                    </p>
                                </div>
                                <span className="shrink-0 text-sm font-bold tabular-nums text-content-heading">
                                    {item.quantity} {item.unit}
                                </span>
                            </div>
                        ))}
                    </div>

                    {!issuing ? (
                        <div className="space-y-2">
                            <Label htmlFor="liff-stock-cancel-reason" className="font-semibold">
                                เหตุผล (ถ้ามี)
                            </Label>
                            <Textarea
                                id="liff-stock-cancel-reason"
                                value={reason}
                                onChange={(event) => setReason(event.target.value)}
                                maxLength={500}
                                disabled={busy}
                                placeholder="ระบุเหตุผลเพื่อให้ผู้เกี่ยวข้องทราบ"
                                className="min-h-24 rounded-xl border-border-subtle bg-surface"
                            />
                        </div>
                    ) : null}

                    {error ? (
                        <div
                            role="alert"
                            className="rounded-xl bg-status-error-surface px-3 py-2 text-sm leading-6 text-status-error-strong ring-1 ring-status-error-border"
                        >
                            {error}
                        </div>
                    ) : null}
                </div>

                <div className="sticky bottom-0 z-20 border-t border-border-subtle bg-surface-raised px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
                    {actionAvailable ? (
                        <Button
                            type="button"
                            onClick={() => onConfirm(reason.trim() || undefined)}
                            disabled={busy}
                            className={`min-h-12 w-full rounded-xl font-bold text-content-on-brand ${
                                issuing
                                    ? "bg-status-success-solid hover:bg-status-success-solid-hover"
                                    : "bg-status-danger-solid hover:bg-status-danger-solid-hover"
                            }`}
                        >
                            {busy ? (
                                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                            ) : null}
                            {confirmationLabel}
                        </Button>
                    ) : null}
                </div>
            </DialogContent>
        </Dialog>
    );
}
