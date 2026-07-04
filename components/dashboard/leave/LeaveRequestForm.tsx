"use client";

import { AlertCircle, Loader2, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { LEAVE_THEME_BUTTON_CLASS } from "./leaveTheme";
import { useLeaveRequestFormModel } from "@/hooks/leave/useLeaveRequestFormModel";
import type { LeaveQuota } from "@/hooks/useLeaveProfile";
import { LeaveDialogFields } from "./_components/LeaveRequestFormFields";

interface Props {
    open: boolean;
    onSuccess: () => void | Promise<void>;
    onCancel: () => void;
    quotas: LeaveQuota[];
}

type LeaveRequestFormModel = ReturnType<typeof useLeaveRequestFormModel>;

export function LeaveRequestForm({ open, onSuccess, onCancel, quotas }: Props) {
    const model = useLeaveRequestFormModel({ onSuccess, quotas });

    const closeDialog = (): void => {
        if (model.isSubmitting) {
            return;
        }

        model.resetForm();
        onCancel();
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen) {
                    closeDialog();
                }
            }}
        >
            <DialogContent
                showCloseButton={false}
                className="flex max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-xl p-0 sm:max-w-[720px]"
                onEscapeKeyDown={(event) => {
                    if (model.isSubmitting) {
                        event.preventDefault();
                    }
                }}
                onInteractOutside={(event) => {
                    if (model.isSubmitting) {
                        event.preventDefault();
                    }
                }}
            >
                <DialogClose asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={model.isSubmitting}
                        className="absolute right-4 top-4"
                        aria-label="ปิดแบบฟอร์มยื่นคำขอลา"
                    >
                        <X />
                    </Button>
                </DialogClose>
                <DialogHeader className="shrink-0 gap-2 border-b border-border bg-muted/30 px-5 py-4 pr-12 text-left sm:px-6">
                    <DialogTitle className="text-lg font-semibold text-foreground">
                        ยื่นคำขอลา
                    </DialogTitle>
                    <DialogDescription className="max-w-[64ch] text-sm leading-6 text-muted-foreground">
                        กรอกช่วงวันที่และเหตุผลให้ครบถ้วน ระบบจะตรวจเงื่อนไขลาย้อนหลังและการลาเกินสิทธิ์ให้ก่อนส่งคำขอ
                    </DialogDescription>
                </DialogHeader>

                <Form {...model.form}>
                    <form
                        onSubmit={model.form.handleSubmit(model.submit)}
                        className="flex min-h-0 flex-1 flex-col"
                    >
                        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
                            <div className="flex flex-col gap-5">
                                <LeaveErrorAlert message={model.errorMsg} />
                                <LeaveExceptionNotice model={model} />
                                <LeaveDialogFields model={model} />
                            </div>
                        </div>
                        <Separator />
                        <DialogFooter className="shrink-0 gap-2 px-5 py-4 sm:px-6">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={model.isSubmitting}
                                onClick={closeDialog}
                            >
                                ยกเลิก
                            </Button>
                            <Button
                                type="submit"
                                className={LEAVE_THEME_BUTTON_CLASS}
                                disabled={model.isSubmitting}
                            >
                                {model.isSubmitting ? (
                                    <Loader2 data-icon="inline-start" className="animate-spin" />
                                ) : null}
                                {model.isSubmitting ? "กำลังส่งคำขอ" : "ส่งคำขอลา"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
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
    if (!model.needsEmergencyReason && !model.needsSpecialReason) {
        return null;
    }

    return (
        <Alert className="border-amber-200 bg-amber-50 text-amber-950 [&>svg]:text-amber-700">
            <AlertCircle className="size-4" />
            <AlertTitle>รายการนี้ต้องระบุเหตุผลเพิ่มเติม</AlertTitle>
            <AlertDescription className="flex flex-col gap-1 leading-6">
                {model.needsEmergencyReason ? (
                    <span>ลาย้อนหลัง: ระบุเหตุผลฉุกเฉินที่ทำให้ยื่นคำขอไม่ทัน</span>
                ) : null}
                {model.needsSpecialReason ? (
                    <span>
                        เกินสิทธิ์: คำขอนี้เกินสิทธิ์ {model.overQuotaDays} วัน จากคงเหลือ{" "}
                        {model.remainingQuota} วัน
                    </span>
                ) : null}
            </AlertDescription>
        </Alert>
    );
}
