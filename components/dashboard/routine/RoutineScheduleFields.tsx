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
    onScheduleTypeChange: (value: RoutineScheduleType) => void;
    onScheduleConfigChange: (value: Record<string, unknown>) => void;
    onBusinessDayPolicyChange: (value: RoutineBusinessDayPolicy) => void;
}

function defaultScheduleConfig(type: RoutineScheduleType): Record<string, unknown> {
    switch (type) {
        case "MONTHLY_DAY":
            return { day: 10, monthOffset: 0 };
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
    return String(numberValue(config[key], fallback));
}

export function RoutineScheduleFields({
    scheduleType,
    scheduleConfig,
    businessDayPolicy,
    onScheduleTypeChange,
    onScheduleConfigChange,
    onBusinessDayPolicyChange,
}: RoutineScheduleFieldsProps) {
    function updateNumber(key: string, event: ChangeEvent<HTMLInputElement>): void {
        const value = Number(event.target.value);
        onScheduleConfigChange({
            ...scheduleConfig,
            [key]: Number.isFinite(value) ? value : 0,
        });
    }

    function updateDate(key: string, event: ChangeEvent<HTMLInputElement>): void {
        onScheduleConfigChange({ ...scheduleConfig, [key]: event.target.value });
    }

    return (
        <fieldset className="space-y-3 rounded-lg border border-border-subtle bg-surface-subtle p-4">
            <legend className="px-1 text-sm font-semibold text-content-heading">
                กำหนดตารางงาน
            </legend>
            <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-1 text-sm font-medium text-content-body">
                    รูปแบบการเกิดงาน
                    <select
                        className="h-11 rounded-md border border-input bg-background px-3 text-sm"
                        value={scheduleType}
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
                <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm font-medium text-content-body">
                        วันที่ของเดือน
                        <Input type="number" min={1} max={31} value={configInput(scheduleConfig, "day", 10)} onChange={(event) => updateNumber("day", event)} />
                    </label>
                    <label className="grid gap-1 text-sm font-medium text-content-body">
                        เดือนที่เลื่อนจากรอบปกติ
                        <Input type="number" min={-120} max={120} value={configInput(scheduleConfig, "monthOffset")} onChange={(event) => updateNumber("monthOffset", event)} />
                    </label>
                </div>
            ) : null}

            {scheduleType === "INTERVAL_MONTHS" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm font-medium text-content-body">
                        ทำซ้ำทุกกี่เดือน
                        <Input type="number" min={1} max={120} value={configInput(scheduleConfig, "intervalMonths", 3)} onChange={(event) => updateNumber("intervalMonths", event)} />
                    </label>
                    <label className="grid gap-1 text-sm font-medium text-content-body">
                        วันที่เริ่มนับรอบ
                        <Input type="date" value={typeof scheduleConfig.anchorDate === "string" ? scheduleConfig.anchorDate : ""} onChange={(event) => updateDate("anchorDate", event)} />
                    </label>
                </div>
            ) : null}

            {scheduleType === "YEARLY_DATE" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-sm font-medium text-content-body">
                        เดือน
                        <Input type="number" min={1} max={12} value={configInput(scheduleConfig, "month", 3)} onChange={(event) => updateNumber("month", event)} />
                    </label>
                    <label className="grid gap-1 text-sm font-medium text-content-body">
                        วันที่
                        <Input type="number" min={1} max={31} value={configInput(scheduleConfig, "day", 31)} onChange={(event) => updateNumber("day", event)} />
                    </label>
                </div>
            ) : null}

            {scheduleType === "ONE_TIME" ? (
                <label className="grid gap-1 text-sm font-medium text-content-body">
                    วันที่ครบกำหนด
                    <Input type="date" value={typeof scheduleConfig.date === "string" ? scheduleConfig.date : ""} onChange={(event) => updateDate("date", event)} />
                </label>
            ) : null}

            {scheduleType === "MONTH_END" ? (
                <p className="text-xs leading-5 text-content-secondary">
                    ระบบใช้วันสุดท้ายจริงของเดือน รวมเดือนกุมภาพันธ์และปีอธิกสุรทิน
                </p>
            ) : null}
            {scheduleType === "MANUAL" ? (
                <p className="text-xs leading-5 text-content-secondary">
                    งานแบบสร้างเองจะไม่สร้างงานแต่ละรอบโดยอัตโนมัติ
                </p>
            ) : null}
            {businessDayPolicy !== "NONE" ? (
                <p className="text-xs leading-5 text-status-warning-foreground">
                    ระยะนี้เลื่อนเฉพาะเสาร์–อาทิตย์ ยังไม่รวมวันหยุดนักขัตฤกษ์
                </p>
            ) : null}
        </fieldset>
    );
}
