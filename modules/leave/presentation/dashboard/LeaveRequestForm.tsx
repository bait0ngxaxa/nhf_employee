"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    AsyncFormDialog,
    AsyncFormDialogClose,
    AsyncFormDialogContent,
} from "@/components/ui/async-form-dialog";
import { Button } from "@/components/ui/button";
import {
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { LEAVE_THEME_BUTTON_CLASS } from "./leaveTheme";
import { useLeaveRequestFormModel } from "./hooks/useLeaveRequestFormModel";
import type { LeaveQuota } from "./hooks/useLeaveProfile";
import { LeaveDialogFields } from "./components/LeaveRequestFormFields";
import { LeaveRequestReview } from "./components/LeaveRequestReview";

interface Props {
    open: boolean;
    onSuccess: () => void | Promise<void>;
    onCancel: () => void;
    quotas: LeaveQuota[];
    canCreateRequests?: boolean;
}

type LeaveRequestFormModel = ReturnType<typeof useLeaveRequestFormModel>;

export function LeaveRequestForm({
    open,
    onSuccess,
    onCancel,
    quotas,
    canCreateRequests = true,
}: Props) {
    const model = useLeaveRequestFormModel({
        onSuccess,
        quotas,
        canSubmit: canCreateRequests,
    });
    const isReview = model.step === "review";

    return (
        <AsyncFormDialog
            open={open}
            busy={model.isSubmitting}
            dirty={model.isDirty}
            onClose={onCancel}
            onDiscard={model.resetForm}
        >
            <AsyncFormDialogContent
                scrollMode="area"
                className="flex flex-col overflow-hidden rounded-xl p-0 sm:max-w-[720px]"
            >
                <AsyncFormDialogClose
                    variant="ghost"
                    size="icon-sm"
                    className="absolute right-4 top-4"
                    aria-label="ปิดแบบฟอร์มยื่นคำขอลา"
                />
                <DialogHeader className="shrink-0 gap-2 border-b border-border bg-muted/30 px-5 py-4 pr-12 text-left sm:px-6">
                    <p className="text-xs font-medium text-muted-foreground" aria-live="polite">
                        {isReview ? "ขั้นตอน 2 จาก 2 · ตรวจสอบก่อนส่ง" : "ขั้นตอน 1 จาก 2 · กรอกข้อมูล"}
                    </p>
                    <DialogTitle className="text-lg font-semibold text-foreground">
                        ยื่นคำขอลา
                    </DialogTitle>
                    <DialogDescription className="max-w-[64ch] text-sm leading-6 text-muted-foreground">
                        {isReview
                            ? "ตรวจสอบรายละเอียดให้ถูกต้องก่อนยืนยันส่งคำขอ"
                            : "กรอกช่วงวันที่และเหตุผลให้ครบถ้วน ระบบจะตรวจเงื่อนไขลาย้อนหลังและการลาเกินสิทธิ์ให้ก่อนส่งคำขอ"}
                    </DialogDescription>
                </DialogHeader>

                <Form {...model.form}>
                    <form
                        onSubmit={model.form.handleSubmit(isReview ? model.submit : model.goToReview, () => { if (isReview) model.backToEdit(); })}
                        className="flex min-h-0 flex-1 flex-col"
                    >
                        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                            <div className="flex flex-col gap-5">
                                <LeaveErrorAlert message={model.errorMsg} />
                                {isReview ? <LeaveRequestReview model={model} /> : null}
                                <div className="flex flex-col gap-5" hidden={isReview}>
                                    <LeaveExceptionNotice model={model} />
                                    <LeaveDialogFields model={model} />
                                </div>
                            </div>
                        </div>
                        <Separator />
                        <DialogFooter className="shrink-0 gap-2 px-5 py-4 sm:px-6">
                            {isReview ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={model.isSubmitting}
                                    onClick={model.backToEdit}
                                >
                                    แก้ไข
                                </Button>
                            ) : (
                                <AsyncFormDialogClose
                                    variant="outline"
                                >
                                    ยกเลิก
                                </AsyncFormDialogClose>
                            )}
                            <Button
                                type="submit"
                                className={LEAVE_THEME_BUTTON_CLASS}
                                disabled={model.isSubmitting || !canCreateRequests}
                                aria-busy={model.isSubmitting}
                            >
                                {model.isSubmitting ? (
                                    <Loader2
                                        data-icon="inline-start"
                                        className="animate-spin"
                                        aria-hidden="true"
                                    />
                                ) : null}
                                {getSubmitLabel(isReview, model.isSubmitting)}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </AsyncFormDialogContent>
        </AsyncFormDialog>
    );
}

function getSubmitLabel(isReview: boolean, isSubmitting: boolean): string {
    if (!isReview) return "ตรวจสอบคำขอ";
    return isSubmitting ? "กำลังส่งคำขอ" : "ยืนยันส่งคำขอลา";
}

function LeaveErrorAlert({ message }: { message: string | null }) {
    if (!message) {
        return null;
    }

    return (
        <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription className="break-words leading-6">{message}</AlertDescription>
        </Alert>
    );
}

function LeaveExceptionNotice({ model }: { model: LeaveRequestFormModel }) {
    if (!model.needsEmergencyReason) {
        return null;
    }

    return (
        <Alert className="border-status-warning-border bg-status-warning-surface text-status-warning-heading [&>svg]:text-status-warning-foreground">
            <AlertCircle className="size-4" />
            <AlertTitle>รายการนี้ต้องระบุเหตุผลเพิ่มเติม</AlertTitle>
            <AlertDescription className="flex flex-col gap-1 leading-6">
                <span>
                    ลาย้อนหลัง: ระบุเหตุผลในการลาย้อนหลัง เพื่อให้ผู้อนุมัติเห็นว่าทำไมจึงยื่นไม่ทัน
                </span>
            </AlertDescription>
        </Alert>
    );
}
