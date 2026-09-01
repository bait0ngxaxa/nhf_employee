"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useEffect, useState, type ReactElement } from "react";

import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetScrollArea,
    SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { LiffLeaveAvailableAction } from "./LiffLeaveRequestDetail";

export interface LiffLeaveMutationIntent {
    requestId: string;
    action: LiffLeaveAvailableAction;
    title: string;
    summary: string;
    hasWarnings?: boolean;
}

interface LiffLeaveDecisionSheetProps {
    intent: LiffLeaveMutationIntent | null;
    busy: boolean;
    error: string | null;
    onOpenChange: (open: boolean) => void;
    onConfirm: (reason: string | undefined) => void | Promise<void>;
}

type ReasonRule = "NONE" | "OPTIONAL_LONG" | "REQUIRED" | "REQUIRED_LONG";

const MINIMUM_LONG_REASON_LENGTH = 5;

const ACTION_CONTENT: Record<LiffLeaveAvailableAction, {
    heading: string;
    consequence: string;
    confirmLabel: string;
    reasonLabel?: string;
    reasonPlaceholder?: string;
    reasonRule?: ReasonRule;
    destructive?: boolean;
}> = {
    CANCEL: {
        heading: "ยกเลิกคำขอลา?",
        consequence: "คำขอที่ยังรออนุมัติจะถูกยกเลิกทันที",
        confirmLabel: "ยืนยันยกเลิก",
        destructive: true,
    },
    REQUEST_CANCELLATION: {
        heading: "ขอยกเลิกวันลา?",
        consequence: "ผู้อนุมัติต้องพิจารณาก่อน ระบบจึงจะยกเลิกวันลาและคืนโควต้า",
        confirmLabel: "ส่งคำขอยกเลิก",
        reasonLabel: "เหตุผล (ไม่บังคับ)",
        reasonPlaceholder: "ระบุเหตุผลที่ต้องการยกเลิก",
        reasonRule: "OPTIONAL_LONG",
    },
    REQUEST_NOT_TAKEN: {
        heading: "แจ้งไม่ได้ใช้วันลา?",
        consequence: "ผู้อนุมัติต้องยืนยันก่อน ระบบจึงจะคืนโควต้า",
        confirmLabel: "ส่งคำขอ",
        reasonLabel: "เหตุผลหรือรายละเอียด",
        reasonPlaceholder: "ระบุว่าเหตุใดจึงไม่ได้ใช้วันลา",
        reasonRule: "REQUIRED_LONG",
    },
    APPROVE: {
        heading: "อนุมัติคำขอลา?",
        consequence: "ระบบจะบันทึกการอนุมัติและตัดโควต้าตามกฎของคำขอนี้",
        confirmLabel: "ยืนยันอนุมัติ",
    },
    REJECT: {
        heading: "ไม่อนุมัติคำขอลา?",
        consequence: "พนักงานจะได้รับผลการพิจารณาพร้อมเหตุผลที่ระบุ",
        confirmLabel: "ยืนยันไม่อนุมัติ",
        reasonLabel: "เหตุผลที่ไม่อนุมัติ",
        reasonPlaceholder: "ระบุเหตุผลให้พนักงานทราบ",
        reasonRule: "REQUIRED",
        destructive: true,
    },
    CONFIRM_NOT_TAKEN: {
        heading: "ยืนยันไม่ได้ใช้วันลา?",
        consequence: "ระบบจะเปลี่ยนสถานะเป็นไม่ได้ใช้วันลาและคืนโควต้าตามคำขอเดิม",
        confirmLabel: "ยืนยันและคืนโควต้า",
    },
    CONFIRM_CANCELLATION: {
        heading: "ยืนยันยกเลิกวันลา?",
        consequence: "ระบบจะยกเลิกวันลาที่อนุมัติแล้วและคืนโควต้าตามกฎเดิม",
        confirmLabel: "ยืนยันยกเลิก",
    },
    REJECT_CANCELLATION: {
        heading: "ปฏิเสธคำขอยกเลิก?",
        consequence: "คำขอลาฉบับเดิมจะยังคงสถานะอนุมัติ และพนักงานจะไม่สามารถขอยกเลิกซ้ำ",
        confirmLabel: "คงวันลาเดิม",
        reasonLabel: "เหตุผล (ไม่บังคับ)",
        reasonPlaceholder: "ระบุเหตุผลให้พนักงานทราบ",
        destructive: true,
    },
};

function getReasonValidationMessage(
    rule: ReasonRule,
    reason: string,
): string | null {
    const length = reason.trim().length;

    if (rule === "REQUIRED" && length === 0) {
        return "กรุณาระบุเหตุผลในการไม่อนุมัติ";
    }
    if (rule === "REQUIRED_LONG" && length < MINIMUM_LONG_REASON_LENGTH) {
        return "กรุณาระบุอย่างน้อย 5 ตัวอักษร";
    }
    if (
        rule === "OPTIONAL_LONG"
        && length > 0
        && length < MINIMUM_LONG_REASON_LENGTH
    ) {
        return "หากระบุเหตุผล กรุณาระบุอย่างน้อย 5 ตัวอักษร";
    }
    return null;
}

export function LiffLeaveDecisionSheet({
    intent,
    busy,
    error,
    onOpenChange,
    onConfirm,
}: LiffLeaveDecisionSheetProps): ReactElement {
    const [reason, setReason] = useState("");
    const content = intent ? ACTION_CONTENT[intent.action] : null;

    useEffect(() => {
        if (intent) setReason("");
    }, [intent]);

    const reasonValidationMessage = getReasonValidationMessage(
        content?.reasonRule ?? "NONE",
        reason,
    );
    const reasonInvalid = reasonValidationMessage !== null;

    return (
        <Sheet
            open={intent !== null}
            onOpenChange={(open) => {
                if (!busy) onOpenChange(open);
            }}
        >
            <SheetContent
                side="bottom"
                scrollMode="area"
                closeButtonLabel="ปิดการยืนยันดำเนินการคำขอลา"
                className="gap-0 rounded-t-xl border-0 p-0 sm:left-1/2 sm:max-w-lg sm:-translate-x-1/2"
            >
                {intent && content ? (
                    <>
                        <SheetHeader className="shrink-0 border-b border-border-subtle bg-surface px-4 py-4 pr-12 text-left">
                            <SheetTitle className="text-xl">{content.heading}</SheetTitle>
                            <SheetDescription className="leading-6">
                                {intent.title} · {intent.summary}
                            </SheetDescription>
                        </SheetHeader>
                        <SheetScrollArea className="space-y-4 px-4 py-4 scroll-pb-4">
                            <div className="rounded-xl border border-border-subtle bg-surface-subtle px-3 py-3 text-sm leading-6 text-content-body">
                                {content.consequence}
                            </div>
                            {intent.hasWarnings ? (
                                <div className="flex items-start gap-2 rounded-xl border border-status-warning-border bg-status-warning-surface px-3 py-3 text-sm leading-6 text-status-warning-strong">
                                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                                    คำขอนี้มีเหตุผลฉุกเฉิน เหตุผลพิเศษ หรือวันลาเกินสิทธิ์ กรุณาตรวจรายละเอียดก่อนยืนยัน
                                </div>
                            ) : null}
                            {content.reasonLabel ? (
                                <label className="grid gap-2 text-sm font-medium text-content-heading">
                                    {content.reasonLabel}
                                    <Textarea
                                        value={reason}
                                        rows={4}
                                        maxLength={1000}
                                        className="min-h-24 resize-none"
                                        placeholder={content.reasonPlaceholder}
                                        disabled={busy}
                                        aria-invalid={reasonInvalid}
                                        aria-describedby={reasonInvalid
                                            ? "liff-leave-decision-reason-error"
                                            : undefined}
                                        onChange={(event) => setReason(event.target.value)}
                                    />
                                    {reasonValidationMessage ? (
                                        <span
                                            id="liff-leave-decision-reason-error"
                                            className="text-xs font-normal text-status-danger-strong"
                                        >
                                            {reasonValidationMessage}
                                        </span>
                                    ) : null}
                                </label>
                            ) : null}
                            {error ? (
                                <p role="alert" className="text-sm font-medium leading-6 text-status-danger-strong">
                                    {error}
                                </p>
                            ) : null}
                        </SheetScrollArea>
                        <div className="shrink-0 border-t border-border-subtle bg-surface px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="min-h-12"
                                    disabled={busy}
                                    onClick={() => onOpenChange(false)}
                                >
                                    กลับ
                                </Button>
                                <Button
                                    type="button"
                                    variant={content.destructive ? "destructive" : "default"}
                                    className={content.destructive
                                        ? "min-h-12"
                                        : "min-h-12 bg-module-leave-solid text-content-on-brand hover:bg-module-leave-solid-hover"}
                                    disabled={busy || reasonInvalid}
                                    aria-busy={busy}
                                    onClick={() => void onConfirm(reason.trim() || undefined)}
                                >
                                    {busy ? (
                                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                                    ) : null}
                                    {busy ? "กำลังดำเนินการ..." : content.confirmLabel}
                                </Button>
                            </div>
                        </div>
                    </>
                ) : null}
            </SheetContent>
        </Sheet>
    );
}
