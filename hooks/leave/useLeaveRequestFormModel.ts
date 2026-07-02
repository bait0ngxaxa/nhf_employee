import { useState } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { leaveRequestSchema, type LeaveRequestValues } from "@/lib/validations/leave";
import { submitLeaveRequest } from "@/lib/services/leave/client";
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
    isMultiDay: boolean;
    startDateValue: string;
    needsEmergencyReason: boolean;
    needsSpecialReason: boolean;
    requestedDays: number;
    overQuotaDays: number;
    remainingQuota: number;
    submit: (data: LeaveRequestValues) => Promise<void>;
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
    const [isMultiDay, setIsMultiDay] = useState(false);

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
    const overQuotaDays = quota ? Math.max(0, requestedDays - remainingQuota) : 0;
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

    const resetForm = (): void => {
        form.reset(createDefaultLeaveRequestValues());
        setErrorMsg(null);
        setIsMultiDay(false);
    };

    const submit = async (data: LeaveRequestValues): Promise<void> => {
        const submitOverQuotaDays = getOverQuotaDays(data, quotas);
        if (submitOverQuotaDays > 0 && !data.specialReason?.trim()) {
            form.setError("specialReason", {
                type: "manual",
                message: LEAVE_REQUEST_MESSAGES.specialReasonRequired,
            });
            return;
        }

        setIsSubmitting(true);
        setErrorMsg(null);
        try {
            await submitLeaveRequest(data);
            toast.success(LEAVE_REQUEST_MESSAGES.success);
            await onSuccess();
            resetForm();
        } catch (error) {
            const rawMessage = error instanceof Error && error.message ? error.message : "";
            const message = normalizeLeaveRequestErrorMessage(rawMessage);
            setErrorMsg(message);
            toast.error(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return {
        form,
        isSubmitting,
        errorMsg,
        isMultiDay,
        startDateValue,
        needsEmergencyReason,
        needsSpecialReason,
        requestedDays,
        overQuotaDays,
        remainingQuota,
        submit,
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

function getOverQuotaDays(
    data: LeaveRequestValues,
    quotas: LeaveQuotaSnapshot[],
): number {
    const quota = quotas.find((item) => item.leaveType === data.leaveType);
    if (!quota) {
        return 0;
    }

    const requestedDays = getRequestedDays(data.startDate, data.endDate, data.period);
    const remainingQuota = quota.totalDays - quota.usedDays;
    return Math.max(0, requestedDays - remainingQuota);
}
