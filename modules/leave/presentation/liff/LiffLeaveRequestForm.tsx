"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import type { ReactElement } from "react";

import { LeaveDialogFields } from "../dashboard/components/LeaveRequestFormFields";
import { LeaveRequestReview } from "../dashboard/components/LeaveRequestReview";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetScrollArea,
    SheetTitle,
} from "@/components/ui/sheet";
import { useLeaveRequestFormModel } from "../dashboard/hooks/useLeaveRequestFormModel";
import {
    isRecoveredLiffMutation,
} from "@/modules/line/client";
import { submitLiffLeaveRequest } from "./api";
import type { LiffLeaveQuotaSummary } from "../types";

interface LiffLeaveRequestFormProps {
    open: boolean;
    quotas: LiffLeaveQuotaSummary[];
    canCreateRequests?: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void | Promise<void>;
    onAmbiguousSubmit?: () => void | Promise<void>;
}

export function LiffLeaveRequestForm({
    open,
    quotas,
    canCreateRequests = true,
    onOpenChange,
    onSuccess,
    onAmbiguousSubmit,
}: LiffLeaveRequestFormProps): ReactElement {
    const model = useLeaveRequestFormModel({
        quotas,
        submitRequest: submitLiffLeaveRequest,
        canSubmit: canCreateRequests,
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

    const isReview = model.step === "review";

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
                scrollMode="area"
                closeButtonLabel="ปิดแบบฟอร์มยื่นคำขอลา"
                className="h-screen max-h-screen supports-[height:100dvh]:h-[100dvh] supports-[height:100dvh]:max-h-[100dvh] gap-0 rounded-none border-0 p-0 sm:left-1/2 sm:max-w-lg sm:-translate-x-1/2"
            >
                <SheetHeader className="shrink-0 border-b border-border-subtle bg-surface px-5 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] pr-16 text-left">
                    <p className="text-xs font-medium text-content-secondary" aria-live="polite">
                        {isReview ? "ขั้นตอน 2 จาก 2 · ตรวจสอบก่อนส่ง" : "ขั้นตอน 1 จาก 2 · กรอกข้อมูล"}
                    </p>
                    <SheetTitle className="text-xl font-bold tracking-tight text-content-heading">
                        ยื่นคำขอลา
                    </SheetTitle>
                    <SheetDescription className="leading-6 text-content-secondary">
                        {isReview
                            ? "ตรวจสอบรายละเอียดให้ถูกต้องก่อนยืนยันส่งคำขอ"
                            : "เลือกวันลาและระบุเหตุผล ระบบจะตรวจเงื่อนไขก่อนส่งคำขอ"}
                    </SheetDescription>
                </SheetHeader>

                <Form {...model.form}>
                    <form
                        onSubmit={model.form.handleSubmit(isReview ? model.submit : model.goToReview)}
                        className="flex min-h-0 flex-1 flex-col bg-surface-subtle"
                    >
                        <SheetScrollArea className="scroll-pb-6 px-4 py-5">
                            <div className="space-y-4">
                                {model.errorMsg ? (
                                    <Alert variant="destructive" role="alert">
                                        <AlertCircle className="size-4" aria-hidden="true" />
                                        <AlertDescription className="break-words leading-6">
                                            {model.errorMsg}
                                        </AlertDescription>
                                    </Alert>
                                ) : null}
                                {isReview ? <LeaveRequestReview model={model} /> : null}
                                <div className="space-y-4" hidden={isReview}>
                                    {model.needsEmergencyReason ? (
                                        <Alert className="border-status-warning-border bg-status-warning-surface text-status-warning-heading [&>svg]:text-status-warning-foreground">
                                            <AlertCircle className="size-4" aria-hidden="true" />
                                            <AlertTitle>ต้องระบุข้อมูลประกอบเพิ่มเติม</AlertTitle>
                                            <AlertDescription className="space-y-1 leading-6">
                                                <p>เป็นการลาย้อนหลัง กรุณาระบุเหตุผลให้ผู้อนุมัติพิจารณา</p>
                                            </AlertDescription>
                                        </Alert>
                                    ) : null}
                                    <LeaveDialogFields model={model} />
                                </div>
                            </div>
                        </SheetScrollArea>

                        <div className="shrink-0 grid grid-cols-[0.8fr_1.2fr] gap-2 border-t border-border-subtle bg-surface px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
                            <Button
                                type="button"
                                variant="outline"
                                className="min-h-12"
                                disabled={model.isSubmitting}
                                onClick={isReview ? model.backToEdit : requestClose}
                            >
                                {isReview ? "แก้ไข" : "ยกเลิก"}
                            </Button>
                            <Button
                                type="submit"
                                className="min-h-12 bg-module-leave-solid text-content-on-brand hover:bg-module-leave-solid-hover"
                                disabled={model.isSubmitting || !canCreateRequests}
                                aria-busy={model.isSubmitting}
                            >
                                {model.isSubmitting ? (
                                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                                ) : null}
                                {getSubmitLabel(isReview, model.isSubmitting)}
                            </Button>
                        </div>
                    </form>
                </Form>
            </SheetContent>
        </Sheet>
    );
}

function getSubmitLabel(isReview: boolean, isSubmitting: boolean): string {
    if (!isReview) return "ตรวจสอบคำขอ";
    return isSubmitting ? "กำลังส่ง…" : "ยืนยันส่งคำขอลา";
}
