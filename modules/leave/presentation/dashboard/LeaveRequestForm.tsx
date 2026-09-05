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

interface Props {
    open: boolean;
    onSuccess: () => void | Promise<void>;
    onCancel: () => void;
    quotas: LeaveQuota[];
}

type LeaveRequestFormModel = ReturnType<typeof useLeaveRequestFormModel>;

export function LeaveRequestForm({ open, onSuccess, onCancel, quotas }: Props) {
    const model = useLeaveRequestFormModel({ onSuccess, quotas });

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
                            <AsyncFormDialogClose
                                variant="outline"
                            >
                                ยกเลิก
                            </AsyncFormDialogClose>
                            <Button
                                type="submit"
                                className={LEAVE_THEME_BUTTON_CLASS}
                                disabled={model.isSubmitting}
                                aria-busy={model.isSubmitting}
                            >
                                {model.isSubmitting ? (
                                    <Loader2
                                        data-icon="inline-start"
                                        className="animate-spin"
                                        aria-hidden="true"
                                    />
                                ) : null}
                                {model.isSubmitting ? "กำลังส่งคำขอ" : "ส่งคำขอลา"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </AsyncFormDialogContent>
        </AsyncFormDialog>
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
        <Alert className="border-status-warning-border bg-status-warning-surface text-status-warning-heading [&>svg]:text-status-warning-foreground">
            <AlertCircle className="size-4" />
            <AlertTitle>รายการนี้ต้องระบุเหตุผลเพิ่มเติม</AlertTitle>
            <AlertDescription className="flex flex-col gap-1 leading-6">
                {model.needsEmergencyReason ? (
                    <span>
                        ลาย้อนหลัง: ระบุเหตุผลในการลาย้อนหลัง เพื่อให้ผู้อนุมัติเห็นว่าทำไมจึงยื่นไม่ทัน
                    </span>
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
