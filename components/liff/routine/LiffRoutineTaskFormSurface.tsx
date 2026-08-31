"use client";

import { useRef, type ReactElement } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import type {
    LiffRoutineReferenceData,
    LiffRoutineTaskDetail,
} from "@/lib/client/liff-routine";

import {
    LiffRoutineTaskForm,
    type LiffRoutineTaskFormHandle,
    type LiffRoutineTaskFormMode,
} from "./LiffRoutineTaskForm";

interface LiffRoutineTaskFormSurfaceProps {
    open: boolean;
    mode: LiffRoutineTaskFormMode;
    reference: LiffRoutineReferenceData | null;
    referenceLoading: boolean;
    referenceError: string | null;
    task: LiffRoutineTaskDetail | null;
    onOpenChange: (open: boolean) => void;
    onRetryReference: () => void;
    onSaved: (
        task: LiffRoutineTaskDetail,
        mode: LiffRoutineTaskFormMode,
    ) => void | Promise<void>;
    onReloadLatest?: (taskId: number) => Promise<LiffRoutineTaskDetail>;
    onAmbiguousSubmit?: (
        mode: LiffRoutineTaskFormMode,
    ) => void | Promise<void>;
}

export function LiffRoutineTaskFormSurface({
    open,
    mode,
    reference,
    referenceLoading,
    referenceError,
    task,
    onOpenChange,
    onRetryReference,
    onSaved,
    onReloadLatest,
    onAmbiguousSubmit,
}: LiffRoutineTaskFormSurfaceProps): ReactElement {
    const formRef = useRef<LiffRoutineTaskFormHandle>(null);
    const title = mode === "CREATE" ? "เพิ่ม Routine ของฉัน" : "แก้ไข Routine ของฉัน";

    function requestClose(): void {
        if (formRef.current) {
            formRef.current.requestClose();
            return;
        }
        onOpenChange(false);
    }

    return (
        <Sheet
            open={open}
            onOpenChange={(nextOpen) => {
                if (nextOpen) {
                    onOpenChange(true);
                } else {
                    requestClose();
                }
            }}
        >
            <SheetContent
                side="bottom"
                closeButtonLabel={`ปิด${title}`}
                className="h-[100dvh] max-h-[100dvh] gap-0 overflow-hidden rounded-none border-0 p-0 sm:left-1/2 sm:max-w-2xl sm:-translate-x-1/2"
                aria-busy={referenceLoading}
            >
                <SheetHeader className="shrink-0 border-b border-border-subtle bg-surface px-5 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] pr-16 text-left sm:px-6">
                    <SheetTitle className="text-xl font-bold tracking-tight text-content-heading">
                        {title}
                    </SheetTitle>
                    <SheetDescription className="leading-6 text-content-secondary">
                        {mode === "CREATE"
                            ? "กำหนดรายละเอียด ตารางงาน และการแจ้งเตือนสำหรับงานของคุณ"
                            : "ตรวจสอบข้อมูลล่าสุดก่อนบันทึกการแก้ไข"}
                    </SheetDescription>
                </SheetHeader>

                {referenceLoading ? (
                    <div
                        role="status"
                        aria-live="polite"
                        className="flex min-h-56 flex-1 items-center justify-center gap-2 bg-surface-subtle px-4 text-sm font-medium text-content-secondary"
                    >
                        <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                        กำลังเตรียมข้อมูลสำหรับแบบฟอร์ม...
                    </div>
                ) : referenceError ? (
                    <div className="flex flex-1 items-center justify-center bg-surface-subtle px-4 py-8">
                        <div
                            role="alert"
                            className="w-full max-w-md space-y-4 rounded-2xl border border-status-danger-border bg-status-danger-surface p-5 text-sm leading-6 text-status-danger-foreground"
                        >
                            <div className="flex items-start gap-2">
                                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                                <p>{referenceError}</p>
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                className="min-h-11 border-status-danger-border bg-surface text-status-danger-foreground"
                                onClick={onRetryReference}
                            >
                                <RefreshCw className="size-4" aria-hidden="true" />
                                ลองโหลดข้อมูลอีกครั้ง
                            </Button>
                        </div>
                    </div>
                ) : reference && (mode === "CREATE" || task?.canManage === true) ? (
                    <LiffRoutineTaskForm
                        key={`${mode}-${task?.id ?? "new"}`}
                        ref={formRef}
                        mode={mode}
                        reference={reference}
                        task={task}
                        onCancel={() => onOpenChange(false)}
                        onSaved={onSaved}
                        onReloadLatest={onReloadLatest}
                        onAmbiguousSubmit={onAmbiguousSubmit}
                    />
                ) : (
                    <div role="alert" className="flex flex-1 items-center justify-center bg-surface-subtle px-4 py-8 text-center text-sm leading-6 text-status-danger-foreground">
                        ไม่พบข้อมูลงาน Routine สำหรับเปิดแบบฟอร์ม
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}
