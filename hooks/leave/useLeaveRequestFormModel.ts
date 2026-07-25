import { useRef, useState } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { leaveRequestSchema, type LeaveRequestValues } from "@/lib/validations/leave";
import { submitLeaveRequest } from "@/lib/services/leave/client";
import { calculateAdditionalOverQuotaDays } from "@/lib/services/leave/over-quota";
import {
    LeaveAttachmentValidationError,
    validateLeaveAttachments,
} from "@/lib/validations/leave-attachments";
import {
    calculateLeaveDuration,
    isPastDate,
    type LeavePeriodValue,
} from "@/lib/services/leave/utils";

type LeaveTypeValue = LeaveRequestValues["leaveType"];

interface LeaveQuotaSnapshot {
    leaveType: LeaveTypeValue;
    totalDays: number;
    usedDays: number;
}

interface UseLeaveRequestFormModelArgs {
    onSuccess: () => void | Promise<void>;
    quotas?: LeaveQuotaSnapshot[];
}

interface UseLeaveRequestFormModelResult {
    form: UseFormReturn<LeaveRequestValues>;
    isSubmitting: boolean;
    errorMsg: string | null;
    attachments: File[];
    attachmentError: string | null;
    isMultiDay: boolean;
    startDateValue: string;
    needsEmergencyReason: boolean;
    needsSpecialReason: boolean;
    requestedDays: number;
    overQuotaDays: number;
    remainingQuota: number;
    submit: (data: LeaveRequestValues) => Promise<void>;
    addAttachments: (files: readonly File[]) => void;
    removeAttachment: (index: number) => void;
    clearAttachments: () => void;
    resetForm: () => void;
    switchToSingleDay: () => void;
    switchToMultiDay: () => void;
    handleStartDateChange: (value: string, onFieldChange: (value: string) => void) => void;
}

const getTodayString = (): string => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${month}-${day}`;
};

const createDefaultLeaveRequestValues = (): LeaveRequestValues => {
    const today = getTodayString();

    return {
        leaveType: "SICK",
        startDate: today,
        endDate: today,
        period: "FULL_DAY",
        reason: "",
        emergencyReason: "",
        specialReason: "",
    };
};

const hasThaiText = (value: string): boolean => /[ก-๿]/.test(value);

const LEAVE_REQUEST_MESSAGES = {
    success: "ส่งคำขอลาสำเร็จ",
    holidayConflict: "วันที่ลาตรงกับวันหยุด",
    approverNotConfigured: "ยังไม่ได้ตั้งค่าผู้อนุมัติ",
    overlapConflict: "มีคำขอลาในช่วงวันนี้อยู่แล้ว",
    quotaExceeded: "สิทธิ์ลาคงเหลือไม่เพียงพอ",
    specialReasonRequired: "กรุณาระบุเหตุผลพิเศษสำหรับการลาเกินโควต้า",
    halfDayMultiDate: "การลาครึ่งวันต้องเลือกวันลาเพียงวันเดียว",
    genericError: "ไม่สามารถส่งคำขอลาได้ กรุณาลองใหม่อีกครั้ง",
} as const;

const normalizeLeaveRequestErrorMessage = (rawMessage: string): string => {
    if (!rawMessage) {
        return LEAVE_REQUEST_MESSAGES.genericError;
    }

    if (hasThaiText(rawMessage)) {
        return rawMessage;
    }

    const lower = rawMessage.toLowerCase();
    if (lower.includes("no manager is configured")) {
        return LEAVE_REQUEST_MESSAGES.approverNotConfigured;
    }
    if (lower.includes("holiday")) {
        return LEAVE_REQUEST_MESSAGES.holidayConflict;
    }
    if (lower.includes("overlap")) {
        return LEAVE_REQUEST_MESSAGES.overlapConflict;
    }
    if (lower.includes("quota") || lower.includes("insufficient")) {
        return LEAVE_REQUEST_MESSAGES.quotaExceeded;
    }
    if (lower.includes("half-day")) {
        return LEAVE_REQUEST_MESSAGES.halfDayMultiDate;
    }
    return LEAVE_REQUEST_MESSAGES.genericError;
};

export function useLeaveRequestFormModel({
    onSuccess,
    quotas = [],
}: UseLeaveRequestFormModelArgs): UseLeaveRequestFormModelResult {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [attachments, setAttachments] = useState<File[]>([]);
    const [attachmentError, setAttachmentError] = useState<string | null>(null);
    const [isMultiDay, setIsMultiDay] = useState(false);
    const submittingRef = useRef(false);

    const form = useForm<LeaveRequestValues>({
        resolver: zodResolver(leaveRequestSchema),
        defaultValues: createDefaultLeaveRequestValues(),
    });

    const leaveType = form.watch("leaveType");
    const startDateValue = form.watch("startDate");
    const endDateValue = form.watch("endDate");
    const periodValue = form.watch("period");

    const quota = quotas.find((item) => item.leaveType === leaveType);
    const remainingQuota = quota ? quota.totalDays - quota.usedDays : 0;
    const requestedDays = getRequestedDays(startDateValue, endDateValue, periodValue);
    const overQuotaDays = quota
        ? calculateAdditionalOverQuotaDays(quota.totalDays, quota.usedDays, requestedDays)
        : 0;
    const needsSpecialReason = overQuotaDays > 0;
    const needsEmergencyReason = isValidDateString(startDateValue)
        ? isPastDate(new Date(startDateValue))
        : false;

    const switchToSingleDay = (): void => {
        setIsMultiDay(false);
        form.setValue("endDate", form.getValues("startDate"));
    };

    const switchToMultiDay = (): void => {
        setIsMultiDay(true);
        form.setValue("period", "FULL_DAY");
    };

    const handleStartDateChange = (
        value: string,
        onFieldChange: (value: string) => void,
    ): void => {
        onFieldChange(value);
        if (!isMultiDay) {
            form.setValue("endDate", value);
        }
    };

    const addAttachments = (files: readonly File[]): void => {
        const nextAttachments = [...attachments, ...files];
        try {
            validateLeaveAttachments(nextAttachments);
        } catch (error) {
            setAttachmentError(
                error instanceof LeaveAttachmentValidationError
                    ? error.message
                    : "ไม่สามารถตรวจสอบไฟล์แนบได้",
            );
            return;
        }

        setAttachments(nextAttachments);
        setAttachmentError(null);
    };

    const removeAttachment = (index: number): void => {
        setAttachments((current) =>
            current.filter((_, currentIndex) => currentIndex !== index),
        );
        setAttachmentError(null);
    };

    const clearAttachments = (): void => {
        setAttachments([]);
        setAttachmentError(null);
    };

    const resetForm = (): void => {
        form.reset(createDefaultLeaveRequestValues());
        clearAttachments();
        setErrorMsg(null);
        setIsMultiDay(false);
    };

    const submit = async (data: LeaveRequestValues): Promise<void> => {
        if (submittingRef.current) {
            return;
        }

        const submitQuota = quotas.find((item) => item.leaveType === data.leaveType);
        const submitRequestedDays = getRequestedDays(data.startDate, data.endDate, data.period);
        const submitOverQuotaDays = submitQuota
            ? calculateAdditionalOverQuotaDays(
                submitQuota.totalDays,
                submitQuota.usedDays,
                submitRequestedDays,
            )
            : 0;
        if (submitOverQuotaDays > 0 && !data.specialReason?.trim()) {
            form.setError("specialReason", {
                type: "manual",
                message: LEAVE_REQUEST_MESSAGES.specialReasonRequired,
            });
            return;
        }

        submittingRef.current = true;
        setIsSubmitting(true);
        setErrorMsg(null);
        try {
            try {
                await submitLeaveRequest(data, attachments);
            } catch (error) {
                const rawMessage =
                    error instanceof Error && error.message
                        ? error.message
                        : "";
                const message = normalizeLeaveRequestErrorMessage(rawMessage);
                setErrorMsg(message);
                toast.error(message);
                return;
            }

            resetForm();
            toast.success(LEAVE_REQUEST_MESSAGES.success);
            try {
                await onSuccess();
            } catch (error) {
                console.error("รีเฟรชข้อมูลหลังส่งคำขอลาไม่สำเร็จ", {
                    errorType:
                        error instanceof Error
                            ? error.name
                            : "UnknownError",
                });
            }
        } finally {
            submittingRef.current = false;
            setIsSubmitting(false);
        }
    };

    return {
        form,
        isSubmitting,
        errorMsg,
        attachments,
        attachmentError,
        isMultiDay,
        startDateValue,
        needsEmergencyReason,
        needsSpecialReason,
        requestedDays,
        overQuotaDays,
        remainingQuota,
        submit,
        addAttachments,
        removeAttachment,
        clearAttachments,
        resetForm,
        switchToSingleDay,
        switchToMultiDay,
        handleStartDateChange,
    };
}

function isValidDateString(value: string): boolean {
    return value.length > 0 && !Number.isNaN(new Date(value).getTime());
}

function getRequestedDays(
    startDate: string,
    endDate: string,
    period: LeavePeriodValue,
): number {
    if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
        return 0;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
        return 0;
    }

    return calculateLeaveDuration(start, end, period);
}
