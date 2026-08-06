"use client";

import type { ChangeEvent } from "react";

import {
    ROUTINE_BUSINESS_DAY_POLICIES,
    ROUTINE_SCHEDULE_TYPES,
    type RoutineBusinessDayPolicy,
    type RoutineScheduleType,
} from "@/lib/routine/schedule";

import { Input } from "@/components/ui/input";

import { ROUTINE_SCHEDULE_LABELS } from "./labels";

interface RoutineScheduleFieldsProps {
    scheduleType: RoutineScheduleType;
    scheduleConfig: Record<string, unknown>;
    businessDayPolicy: RoutineBusinessDayPolicy;
    contractStartDate: string;
    contractEndDate: string;
    contractText: string;
    onScheduleTypeChange: (value: RoutineScheduleType) => void;
    onScheduleConfigChange: (value: Record<string, unknown>) => void;
    onBusinessDayPolicyChange: (value: RoutineBusinessDayPolicy) => void;
    onContractStartDateChange: (value: string) => void;
    onContractEndDateChange: (value: string) => void;
    onContractTextChange: (value: string) => void;
    errors?: Record<string, string>;
    disabled?: boolean;
}

function defaultScheduleConfig(type: RoutineScheduleType): Record<string, unknown> {
    switch (type) {
        case "MONTHLY_DAY":
            return { day: 10 };
        case "MONTH_END":
            return {};
        case "INTERVAL_MONTHS":
            return { intervalMonths: 3, anchorDate: "2026-01-01" };
        case "YEARLY_DATE":
            return { month: 3, day: 31 };
        case "ONE_TIME":
            return { date: "2026-07-21" };
        case "MANUAL":
            return {};
    }
}

function numberValue(value: unknown, fallback = 0): number {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function configInput(
    config: Record<string, unknown>,
    key: string,
    fallback = 0,
): string {
    if (typeof config[key] === "string") return config[key];
    return String(numberValue(config[key], fallback));
}

export function RoutineScheduleFields({
    scheduleType,
    scheduleConfig,
    businessDayPolicy,
    contractStartDate,
    contractEndDate,
    contractText,
    onScheduleTypeChange,
    onScheduleConfigChange,
    onBusinessDayPolicyChange,
    onContractStartDateChange,
    onContractEndDateChange,
    onContractTextChange,
    errors = {},
    disabled = false,
}: RoutineScheduleFieldsProps) {
    function updateNumber(key: string, event: ChangeEvent<HTMLInputElement>): void {
        const rawValue = event.target.value;
        const value = rawValue === "" ? "" : Number(rawValue);
        onScheduleConfigChange({
            ...scheduleConfig,
            [key]: typeof value === "number" && !Number.isFinite(value) ? rawValue : value,
        });
    }

    function updateDate(key: string, event: ChangeEvent<HTMLInputElement>): void {
        onScheduleConfigChange({ ...scheduleConfig, [key]: event.target.value });
    }

    function fieldError(key: string): string | undefined {
        return errors[`scheduleConfig.${key}`] ?? errors.scheduleConfig;
    }

    function contractError(key: string): string | undefined {
        return errors[key];
    }

    return (
        <fieldset className="space-y-5 rounded-xl border border-border-subtle bg-surface-subtle p-4 sm:p-5">
            <legend className="px-1 text-base font-semibold text-content-heading">
                กำหนดตารางงาน
            </legend>
            <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-1 text-sm font-medium text-content-body">
                    รูปแบบการเกิดงาน
                    <select
                        className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                        value={scheduleType}
                        disabled={disabled}
                        onChange={(event) => {
                            const nextType = event.target.value as RoutineScheduleType;
                            onScheduleTypeChange(nextType);
                            onScheduleConfigChange(defaultScheduleConfig(nextType));
                        }}
                    >
                        {ROUTINE_SCHEDULE_TYPES.map((type) => (
                            <option key={type} value={type}>
                                {ROUTINE_SCHEDULE_LABELS[type]}
                            </option>
                        ))}
                    </select>
                </label>
                <label className="grid gap-1 text-sm font-medium text-content-body">
                    การเลื่อนวันทำการ
                    <select
                        className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                        value={businessDayPolicy}
                        disabled={disabled}
                        onChange={(event) => onBusinessDayPolicyChange(event.target.value as RoutineBusinessDayPolicy)}
                    >
                        {ROUTINE_BUSINESS_DAY_POLICIES.map((policy) => (
                            <option key={policy} value={policy}>
                                {policy === "NONE"
                                    ? "ไม่เลื่อนวัน"
                                    : policy === "PREVIOUS_BUSINESS_DAY"
                                        ? "วันทำการก่อนหน้า"
                                        : "วันทำการถัดไป"}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            {scheduleType === "MONTHLY_DAY" ? (
                <div className="grid gap-3 sm:max-w-xs">
                    <label className="grid gap-1 text-sm font-medium text-content-body">
                        วันที่ของเดือน
                        <Input data-routine-field="scheduleConfig.day" aria-invalid={Boolean(fieldError("day"))} type="number" min={1} max={31} value={configInput(scheduleConfig, "day", 10)} onChange={(event) => updateNumber("day", event)} disabled={disabled} />
                        {fieldError("day") ? <span className="text-sm font-normal text-status-danger-foreground" role="alert">{fieldError("day")}</span> : null}
                    </label>
                </div>
            ) : null}

            {scheduleType === "INTERVAL_MONTHS" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm font-medium text-content-body">
                        ทำซ้ำทุกกี่เดือน
                        <Input data-routine-field="scheduleConfig.intervalMonths" aria-invalid={Boolean(fieldError("intervalMonths"))} type="number" min={1} max={120} value={configInput(scheduleConfig, "intervalMonths", 3)} onChange={(event) => updateNumber("intervalMonths", event)} disabled={disabled} />
                        {fieldError("intervalMonths") ? <span className="text-sm font-normal text-status-danger-foreground" role="alert">{fieldError("intervalMonths")}</span> : null}
                    </label>
                    <label className="grid gap-1 text-sm font-medium text-content-body">
                        วันที่เริ่มนับรอบ
                        <Input data-routine-field="scheduleConfig.anchorDate" aria-invalid={Boolean(fieldError("anchorDate"))} type="date" value={typeof scheduleConfig.anchorDate === "string" ? scheduleConfig.anchorDate : ""} onChange={(event) => updateDate("anchorDate", event)} disabled={disabled} />
                        {fieldError("anchorDate") ? <span className="text-sm font-normal text-status-danger-foreground" role="alert">{fieldError("anchorDate")}</span> : null}
                    </label>
                </div>
            ) : null}

            {scheduleType === "YEARLY_DATE" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm font-medium text-content-body">
                        เดือน
                        <Input data-routine-field="scheduleConfig.month" aria-invalid={Boolean(fieldError("month"))} type="number" min={1} max={12} value={configInput(scheduleConfig, "month", 3)} onChange={(event) => updateNumber("month", event)} disabled={disabled} />
                        {fieldError("month") ? <span className="text-sm font-normal text-status-danger-foreground" role="alert">{fieldError("month")}</span> : null}
                    </label>
                    <label className="grid gap-1 text-sm font-medium text-content-body">
                        วันที่
                        <Input data-routine-field="scheduleConfig.day" aria-invalid={Boolean(fieldError("day"))} type="number" min={1} max={31} value={configInput(scheduleConfig, "day", 31)} onChange={(event) => updateNumber("day", event)} disabled={disabled} />
                        {fieldError("day") ? <span className="text-sm font-normal text-status-danger-foreground" role="alert">{fieldError("day")}</span> : null}
                    </label>
                </div>
            ) : null}

            {scheduleType === "ONE_TIME" ? (
                <label className="grid gap-1 text-sm font-medium text-content-body">
                    วันที่ครบกำหนด
                    <Input data-routine-field="scheduleConfig.date" aria-invalid={Boolean(fieldError("date"))} type="date" value={typeof scheduleConfig.date === "string" ? scheduleConfig.date : ""} onChange={(event) => updateDate("date", event)} disabled={disabled} />
                    {fieldError("date") ? <span className="text-sm font-normal text-status-danger-foreground" role="alert">{fieldError("date")}</span> : null}
                </label>
            ) : null}

            {scheduleType === "MONTH_END" ? (
                <p className="text-sm leading-6 text-content-secondary">
                    ระบบใช้วันสุดท้ายจริงของเดือน รวมเดือนกุมภาพันธ์และปีอธิกสุรทิน
                </p>
            ) : null}
            {scheduleType === "MANUAL" ? (
                <p className="text-sm leading-6 text-content-secondary">
                    งานแบบสร้างเองจะไม่สร้างงานแต่ละรอบโดยอัตโนมัติ
                </p>
            ) : null}
            <div className="border-t border-border-subtle pt-3">
                <h3 className="text-base font-semibold text-content-heading">ช่วงสัญญา</h3>
                <p className="mt-1 text-sm leading-6 text-content-secondary">
                    ระบุเมื่อรายการนี้มีช่วงเวลาตามสัญญา
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm font-medium text-content-body">
                        วันเริ่มสัญญา
                        <Input data-routine-field="contractStartDate" aria-invalid={Boolean(contractError("contractStartDate"))} type="date" value={contractStartDate} onChange={(event) => onContractStartDateChange(event.target.value)} disabled={disabled} />
                        {contractError("contractStartDate") ? <span className="text-sm font-normal text-status-danger-foreground" role="alert">{contractError("contractStartDate")}</span> : null}
                    </label>
                    <label className="grid gap-1 text-sm font-medium text-content-body">
                        วันสิ้นสุดสัญญา
                        <Input data-routine-field="contractEndDate" aria-invalid={Boolean(contractError("contractEndDate"))} type="date" value={contractEndDate} onChange={(event) => onContractEndDateChange(event.target.value)} disabled={disabled} />
                        {contractError("contractEndDate") ? <span className="text-sm font-normal text-status-danger-foreground" role="alert">{contractError("contractEndDate")}</span> : null}
                    </label>
                    <label className="grid gap-1 text-sm font-medium text-content-body sm:col-span-2">
                        ข้อความช่วงสัญญา
                        <Input data-routine-field="contractText" aria-invalid={Boolean(contractError("contractText"))} value={contractText} onChange={(event) => onContractTextChange(event.target.value)} placeholder="เช่น สัญญาปีงบประมาณ" maxLength={500} disabled={disabled} />
                        {contractError("contractText") ? <span className="text-sm font-normal text-status-danger-foreground" role="alert">{contractError("contractText")}</span> : null}
                    </label>
                </div>
            </div>
            {businessDayPolicy !== "NONE" ? (
                <p className="text-sm leading-6 text-status-warning-foreground">
                    ระยะนี้เลื่อนเฉพาะเสาร์–อาทิตย์ ยังไม่รวมวันหยุดนักขัตฤกษ์
                </p>
            ) : null}
        </fieldset>
    );
}
