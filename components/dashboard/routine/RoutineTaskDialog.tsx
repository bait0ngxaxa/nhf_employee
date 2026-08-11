"use client";

import { useCallback, useEffect, useRef, type ReactElement } from "react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { LoadingState } from "@/components/ui/state";

import {
    RoutineTaskForm,
    type RoutineTaskFormHandle,
} from "./RoutineTaskForm";
import type { RoutineReferenceData, RoutineTask } from "./types";

interface RoutineTaskDialogProps {
    error?: Error;
    intent: "create" | "edit";
    isLoading: boolean;
    mode: "SELF_SERVICE" | "ADMIN";
    onClose: () => void;
    onRetry: () => void;
    onSaved: () => void;
    open: boolean;
    reference: RoutineReferenceData | undefined;
    task: RoutineTask | null;
}

const FOCUSABLE_ELEMENT_SELECTOR =
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function dialogTitle(
    intent: RoutineTaskDialogProps["intent"],
    mode: RoutineTaskDialogProps["mode"],
): string {
    if (intent === "edit") {
        return mode === "SELF_SERVICE"
            ? "แก้ไขแม่แบบงานของฉัน"
            : "แก้ไข Routine";
    }
    return mode === "SELF_SERVICE"
        ? "สร้างแม่แบบงานของฉัน"
        : "สร้างแม่แบบงานประจำ";
}

function isAlertDialogTarget(target: EventTarget | null): boolean {
    return target instanceof Element
        && target.closest('[data-slot="alert-dialog-content"]') !== null;
}

export function RoutineTaskDialog({
    error,
    intent,
    isLoading,
    mode,
    onClose,
    onRetry,
    onSaved,
    open,
    reference,
    task,
}: RoutineTaskDialogProps): ReactElement {
    const formRef = useRef<RoutineTaskFormHandle>(null);
    const restoreFocusElementRef = useRef<HTMLElement | null>(null);
    const requestClose = useCallback((): void => {
        if (formRef.current) {
            formRef.current.requestClose();
            return;
        }
        onClose();
    }, [onClose]);
    const ready = reference !== undefined
        && (intent === "create" || task !== null);

    useEffect(() => {
        if (open) return;

        const rememberFocusTarget = (event: Event): void => {
            if (!(event.target instanceof Element)) return;
            const focusTarget = event.target.closest<HTMLElement>(FOCUSABLE_ELEMENT_SELECTOR);
            if (focusTarget && !focusTarget.matches(":disabled")) {
                restoreFocusElementRef.current = focusTarget;
            }
        };

        document.addEventListener("click", rememberFocusTarget, true);
        document.addEventListener("focusin", rememberFocusTarget, true);
        return () => {
            document.removeEventListener("click", rememberFocusTarget, true);
            document.removeEventListener("focusin", rememberFocusTarget, true);
        };
    }, [open]);

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen) requestClose();
            }}
        >
            <DialogContent
                closeLabel="ปิดแบบฟอร์ม Routine"
                className="flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:max-w-3xl lg:max-w-4xl"
                onCloseAutoFocus={(event) => {
                    const focusTarget = restoreFocusElementRef.current;
                    if (!focusTarget?.isConnected) return;
                    event.preventDefault();
                    focusTarget.focus();
                }}
                onEscapeKeyDown={(event) => {
                    event.preventDefault();
                    requestClose();
                }}
                onInteractOutside={(event) => {
                    if (isAlertDialogTarget(event.target)) return;
                    event.preventDefault();
                    requestClose();
                }}
            >
                <DialogHeader className="shrink-0 gap-2 border-b border-border-subtle bg-surface-subtle px-5 py-4 pr-12 text-left sm:px-6">
                    <DialogTitle className="text-xl font-semibold leading-7 tracking-tight text-content-heading">
                        {dialogTitle(intent, mode)}
                    </DialogTitle>
                    <DialogDescription className="max-w-[70ch] text-sm leading-6 text-content-secondary">
                        กำหนดข้อมูลหลัก ตารางงาน ผู้รับผิดชอบ และการแจ้งเตือน แล้วบันทึกโดยไม่ออกจากรายการ Routine
                    </DialogDescription>
                </DialogHeader>

                {error ? (
                    <div className="space-y-4 p-5 sm:p-6">
                        <p
                            className="rounded-lg border border-status-danger-border bg-status-danger-surface px-4 py-3 text-sm leading-6 text-status-danger-foreground"
                            role="alert"
                        >
                            โหลดข้อมูลสำหรับแบบฟอร์มไม่สำเร็จ: {error.message}
                        </p>
                        <Button type="button" variant="outline" onClick={onRetry}>
                            ลองโหลดอีกครั้ง
                        </Button>
                    </div>
                ) : isLoading || !ready ? (
                    <div className="p-5 sm:p-6">
                        <LoadingState
                            label={intent === "edit"
                                ? "กำลังโหลดข้อมูล Routine สำหรับแก้ไข..."
                                : "กำลังโหลดข้อมูลสำหรับสร้างแม่แบบงาน..."}
                            compact
                        />
                    </div>
                ) : (
                    <RoutineTaskForm
                        ref={formRef}
                        reference={reference}
                        initialTask={intent === "edit" ? task : null}
                        mode={mode}
                        presentation="dialog"
                        onSaved={onSaved}
                        onCancel={onClose}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}
