"use client";

import { Loader2, Trash2 } from "lucide-react";
import type { ReactElement } from "react";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface LiffRoutineDeleteConfirmProps {
    open: boolean;
    taskTitle: string;
    busy: boolean;
    error: string | null;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
}

export function LiffRoutineDeleteConfirm({
    open,
    taskTitle,
    busy,
    error,
    onOpenChange,
    onConfirm,
}: LiffRoutineDeleteConfirmProps): ReactElement {
    return (
        <AlertDialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!busy) onOpenChange(nextOpen);
            }}
        >
            <AlertDialogContent aria-busy={busy}>
                <AlertDialogHeader>
                    <AlertDialogTitle>ยืนยันการลบงาน Routine</AlertDialogTitle>
                    <AlertDialogDescription>
                        งาน “{taskTitle}” จะถูกลบและไม่แสดงในรายการของคุณอีก การดำเนินการนี้ย้อนกลับไม่ได้
                    </AlertDialogDescription>
                </AlertDialogHeader>
                {error ? (
                    <p
                        role="alert"
                        className="rounded-xl border border-status-danger-border bg-status-danger-surface px-3 py-3 text-sm leading-6 text-status-danger-foreground"
                    >
                        {error}
                    </p>
                ) : null}
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={busy}>กลับไปดูงาน</AlertDialogCancel>
                    <AlertDialogAction
                        variant="destructive"
                        disabled={busy}
                        onClick={(event) => {
                            event.preventDefault();
                            onConfirm();
                        }}
                    >
                        {busy ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        ) : (
                            <Trash2 className="size-4" aria-hidden="true" />
                        )}
                        {busy ? "กำลังลบ..." : "ลบงานนี้"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
