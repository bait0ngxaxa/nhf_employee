import { useState } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { leaveRequestSchema, type LeaveRequestValues } from "@/lib/validations/leave";
import { submitLeaveRequest } from "@/lib/services/leave/client";

interface UseLeaveRequestFormModelArgs {
    onSuccess: () => void | Promise<void>;
}

interface UseLeaveRequestFormModelResult {
    form: UseFormReturn<LeaveRequestValues>;
    isSubmitting: boolean;
    errorMsg: string | null;
    isMultiDay: boolean;
    startDateValue: string;
    submit: (data: LeaveRequestValues) => Promise<void>;
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

const hasThaiText = (value: string): boolean => /[\u0E00-\u0E7F]/.test(value);

const LEAVE_REQUEST_MESSAGES = {
    success: "ส่งคำขอลาสำเร็จ",
    holidayConflict: "วันที่ลาตรงกับวันหยุด",
    approverNotConfigured: "ยังไม่ได้ตั้งค่าผู้อนุมัติ",
    overlapConflict: "มีคำขอลาในช่วงวันที่นี้อยู่แล้ว",
    quotaExceeded: "สิทธิ์ลาคงเหลือไม่เพียงพอ",
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
}: UseLeaveRequestFormModelArgs): UseLeaveRequestFormModelResult {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isMultiDay, setIsMultiDay] = useState(false);
    const today = getTodayString();

    const form = useForm<LeaveRequestValues>({
        resolver: zodResolver(leaveRequestSchema),
        defaultValues: {
            leaveType: "SICK",
            startDate: today,
            endDate: today,
            period: "FULL_DAY",
            reason: "",
        },
    });

    const switchToSingleDay = (): void => {
        setIsMultiDay(false);
        form.setValue("endDate", form.getValues("startDate"));
    };

    const switchToMultiDay = (): void => {
        setIsMultiDay(true);
        form.setValue("period", "FULL_DAY");
    };

    const handleStartDateChange = (value: string, onFieldChange: (value: string) => void): void => {
        onFieldChange(value);
        if (!isMultiDay) {
            form.setValue("endDate", value);
        }
    };

    const submit = async (data: LeaveRequestValues): Promise<void> => {
        setIsSubmitting(true);
        setErrorMsg(null);
        try {
            await submitLeaveRequest(data);
            toast.success(LEAVE_REQUEST_MESSAGES.success);
            await onSuccess();
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
        startDateValue: form.watch("startDate"),
        submit,
        switchToSingleDay,
        switchToMultiDay,
        handleStartDateChange,
    };
}
