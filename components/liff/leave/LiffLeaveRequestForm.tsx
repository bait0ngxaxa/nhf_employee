"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import type { ReactElement } from "react";

import { LeaveDialogFields } from "@/components/dashboard/leave/_components/LeaveRequestFormFields";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { useLeaveRequestFormModel } from "@/hooks/leave/useLeaveRequestFormModel";
import {
    isRecoveredLiffMutation,
} from "@/lib/client/liff";
import { submitLiffLeaveRequest } from "@/lib/client/liff-leave";
import type { LiffLeaveQuotaSummary } from "@/lib/types/leave";

interface LiffLeaveRequestFormProps {
    open: boolean;
    quotas: LiffLeaveQuotaSummary[];
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void | Promise<void>;
    onAmbiguousSubmit?: () => void | Promise<void>;
}

export function LiffLeaveRequestForm({
    open,
    quotas,
    onOpenChange,
    onSuccess,
    onAmbiguousSubmit,
}: LiffLeaveRequestFormProps): ReactElement {
    const model = useLeaveRequestFormModel({
        quotas,
        submitRequest: submitLiffLeaveRequest,
        onSuccess: async () => {
            await onSuccess();
            onOpenChange(false);
        },
        onSubmitError: async (error) => {
            if (isRecoveredLiffMutation(error)) {
                await onAmbiguousSubmit?.();
            }
        },
    });

    const requestClose = (): void => {
        if (model.isSubmitting) return;
        if (
            model.isDirty
            && !window.confirm("ยกเลิกการกรอกคำขอลาและทิ้งข้อมูลที่ยังไม่ได้ส่ง?")
        ) {
            return;
        }
        model.resetForm();
        onOpenChange(false);
    };

    return (
        <Sheet
            open={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen) requestClose();
            }}
        >
            <SheetContent
                side="bottom"
                scrollMode="content"
                closeButtonLabel="ปิดแบบฟอร์มยื่นคำขอลา"
                className="h-screen max-h-screen supports-[height:100dvh]:h-[100dvh] supports-[height:100dvh]:max-h-[100dvh] gap-0 scroll-pb-28 rounded-none border-0 p-0 sm:left-1/2 sm:max-w-lg sm:-translate-x-1/2"
            >
                <SheetHeader className="sticky top-0 z-20 shrink-0 border-b border-border-subtle bg-surface px-5 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] pr-16 text-left">
                    <SheetTitle className="text-xl font-bold tracking-tight text-content-heading">
                        ยื่นคำขอลา
                    </SheetTitle>
                    <SheetDescription className="leading-6 text-content-secondary">
                        เลือกวันลาและระบุเหตุผล ระบบจะตรวจเงื่อนไขก่อนส่งคำขอ
                    </SheetDescription>
                </SheetHeader>

                <Form {...model.form}>
                    <form
                        onSubmit={model.form.handleSubmit(model.submit)}
                        className="bg-surface-subtle"
                    >
                        <div className="px-4 py-5">
                            <div className="space-y-4 rounded-2xl bg-surface p-4 shadow-sm">
                                {model.errorMsg ? (
                                    <Alert variant="destructive" role="alert">
                                        <AlertCircle className="size-4" aria-hidden="true" />
                                        <AlertDescription className="break-words leading-6">
                                            {model.errorMsg}
                                        </AlertDescription>
                                    </Alert>
                                ) : null}
                                {model.needsEmergencyReason || model.needsSpecialReason ? (
                                    <Alert className="border-status-warning-border bg-status-warning-surface text-status-warning-heading [&>svg]:text-status-warning-foreground">
                                        <AlertCircle className="size-4" aria-hidden="true" />
                                        <AlertTitle>ต้องระบุข้อมูลประกอบเพิ่มเติม</AlertTitle>
                                        <AlertDescription className="space-y-1 leading-6">
                                            {model.needsEmergencyReason ? (
                                                <p>เป็นการลาย้อนหลัง กรุณาระบุเหตุผลให้ผู้อนุมัติพิจารณา</p>
                                            ) : null}
                                            {model.needsSpecialReason ? (
                                                <p>
                                                    เกินสิทธิ์ {model.overQuotaDays} วัน จากยอดคงเหลือ {model.remainingQuota} วัน
                                                </p>
                                            ) : null}
                                        </AlertDescription>
                                    </Alert>
                                ) : null}
                                <div className="rounded-xl border border-module-leave-badge-border bg-module-leave-badge-surface px-4 py-3">
                                    <p className="text-xs font-semibold text-module-leave-badge-foreground">
                                        ระยะเวลาที่ขอ
                                    </p>
                                    <p className="mt-1 tabular-nums text-xl font-bold text-content-heading">
                                        {model.requestedDays} วัน
                                    </p>
                                </div>
                                <LeaveDialogFields model={model} />
                            </div>
                        </div>

                        <div className="sticky bottom-0 z-20 grid grid-cols-[0.8fr_1.2fr] gap-2 border-t border-border-subtle bg-surface px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
                            <Button
                                type="button"
                                variant="outline"
                                className="min-h-12"
                                disabled={model.isSubmitting}
                                onClick={requestClose}
                            >
                                ยกเลิก
                            </Button>
                            <Button
                                type="submit"
                                className="min-h-12 bg-module-leave-solid text-content-on-brand hover:bg-module-leave-solid-hover"
                                disabled={model.isSubmitting}
                                aria-busy={model.isSubmitting}
                            >
                                {model.isSubmitting ? (
                                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                                ) : null}
                                {model.isSubmitting ? "กำลังส่ง..." : "ส่งคำขอลา"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </SheetContent>
        </Sheet>
    );
}
