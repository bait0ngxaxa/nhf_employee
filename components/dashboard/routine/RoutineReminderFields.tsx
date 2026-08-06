"use client";

import { useId, type ReactElement } from "react";
import { BellPlus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseRoutineSendTime } from "@/lib/routine/schedule";

import type { RoutineReminderRecipientScope } from "./types";

export type RoutineReminderPreset = "monthly" | "yearly" | "contract";

export interface RoutineReminderRuleForm {
    daysBefore: string;
    sendHour: string;
    recipientScope: RoutineReminderRecipientScope;
    isActive: boolean;
}

export const ROUTINE_REMINDER_PRESETS: ReadonlyArray<{
    value: RoutineReminderPreset;
    label: string;
    daysBefore: readonly number[];
}> = [
    { value: "monthly", label: "งานรายเดือน: 3 และ 1 วัน", daysBefore: [3, 1] },
    { value: "yearly", label: "งานรายปี: 14, 7 และ 1 วัน", daysBefore: [14, 7, 1] },
    { value: "contract", label: "งานต่อสัญญา: 30, 7 และ 1 วัน", daysBefore: [30, 7, 1] },
];

export function getRoutineReminderPresetDays(
    preset: RoutineReminderPreset,
): readonly number[] {
    return ROUTINE_REMINDER_PRESETS.find((item) => item.value === preset)?.daysBefore ?? [];
}

export function getRoutineReminderFieldErrors(
    rules: readonly RoutineReminderRuleForm[],
): Record<string, string> {
    return rules.reduce<Record<string, string>>((errors, rule, index) => {
        if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(rule.sendHour)) {
            errors[`reminderRules.${index}.sendHour`] = "ระบุเวลาในรูปแบบ HH:mm";
        } else if (parseRoutineSendTime(rule.sendHour) === null) {
            errors[`reminderRules.${index}.sendHour`] = "ระบบรองรับเฉพาะเวลาเต็มชั่วโมง เช่น 09:00";
        }
        if (!/^\d+$/.test(rule.daysBefore)) {
            errors[`reminderRules.${index}.daysBefore`] = "ระบุจำนวนวันเป็นจำนวนเต็ม";
        }
        return errors;
    }, {});
}

const REMINDER_SCOPE_OPTIONS: ReadonlyArray<{
    value: RoutineReminderRecipientScope;
    label: string;
}> = [
    { value: "ASSIGNEES", label: "ผู้รับผิดชอบ" },
    { value: "ADMINS", label: "ผู้ดูแลระบบ" },
    { value: "ASSIGNEES_AND_ADMINS", label: "ผู้รับผิดชอบและผู้ดูแลระบบ" },
];

function isRoutineReminderPreset(value: string): value is RoutineReminderPreset {
    return ROUTINE_REMINDER_PRESETS.some((preset) => preset.value === value);
}

function isReminderRecipientScope(value: string): value is RoutineReminderRecipientScope {
    return REMINDER_SCOPE_OPTIONS.some((option) => option.value === value);
}

interface RoutineReminderFieldsProps {
    rules: readonly RoutineReminderRuleForm[];
    selectedPreset: RoutineReminderPreset | "";
    errors?: Readonly<Record<string, string>>;
    disabled?: boolean;
    onPresetChange: (preset: RoutineReminderPreset) => void;
    onAddRule: () => void;
    onUpdateRule: (index: number, patch: Partial<RoutineReminderRuleForm>) => void;
    onRemoveRule: (index: number) => void;
}

export function RoutineReminderFields({
    rules,
    selectedPreset,
    errors = {},
    disabled = false,
    onPresetChange,
    onAddRule,
    onUpdateRule,
    onRemoveRule,
}: RoutineReminderFieldsProps): ReactElement {
    const presetId = useId();

    function fieldError(index: number, key: "daysBefore" | "sendHour"): string | undefined {
        return errors[`reminderRules.${index}.${key}`];
    }

    return (
        <fieldset className="space-y-4 rounded-xl border border-border-subtle bg-surface-subtle p-4 sm:p-5">
            <legend className="px-1 text-base font-semibold text-content-heading">
                การแจ้งเตือนล่วงหน้า
            </legend>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                    <p className="text-base font-semibold text-content-heading">ตั้งค่ารอบการแจ้งเตือน</p>
                    <p className="mt-1 max-w-prose text-sm leading-6 text-content-secondary">
                        ตรวจตามเวลาไทย (Asia/Bangkok) และส่งผ่านการแจ้งเตือนในระบบเท่านั้น
                    </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <label htmlFor={presetId} className="grid min-w-0 gap-1 text-sm font-medium text-content-body">
                        รูปแบบการแจ้งเตือน
                        <select
                            id={presetId}
                            className="h-11 min-w-0 rounded-md border border-input bg-background px-3 text-sm sm:min-w-64"
                            value={selectedPreset}
                            disabled={disabled}
                            aria-label="เลือกชุดกฎการแจ้งเตือน"
                            onChange={(event) => {
                                const value = event.target.value;
                                if (isRoutineReminderPreset(value)) onPresetChange(value);
                            }}
                        >
                            <option value="">เลือกรูปแบบการแจ้งเตือน</option>
                            {ROUTINE_REMINDER_PRESETS.map((preset) => (
                                <option key={preset.value} value={preset.value}>
                                    {preset.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    <Button type="button" variant="outline" size="sm" onClick={onAddRule} disabled={disabled}>
                        <BellPlus aria-hidden="true" />
                        เพิ่มกฎ
                    </Button>
                </div>
            </div>
            {rules.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border-subtle bg-background px-4 py-3 text-sm leading-6 text-content-secondary" aria-live="polite">
                    ยังไม่มีกฎ ระบบจะไม่ส่งการแจ้งเตือนสำหรับแม่แบบนี้
                </p>
            ) : (
                <div className="space-y-3">
                    {rules.map((rule, index) => {
                        const daysBeforeError = fieldError(index, "daysBefore");
                        const sendHourError = fieldError(index, "sendHour");
                        return (
                            <div
                                key={index}
                                className="grid min-w-0 gap-4 rounded-lg border border-border-subtle bg-background p-4 sm:grid-cols-2 xl:grid-cols-[minmax(7rem,0.7fr)_minmax(10rem,0.8fr)_minmax(14rem,1.4fr)_auto_auto] xl:items-end"
                            >
                                <label className="grid min-w-0 gap-1 text-sm font-medium text-content-body">
                                    ล่วงหน้า (วัน)
                                    <Input
                                        data-routine-field={`reminderRules.${index}.daysBefore`}
                                        aria-invalid={Boolean(daysBeforeError)}
                                        type="number"
                                        min={0}
                                        max={365}
                                        value={rule.daysBefore}
                                        disabled={disabled}
                                        onChange={(event) => onUpdateRule(index, { daysBefore: event.target.value })}
                                    />
                                    {daysBeforeError ? <span className="text-sm font-normal text-status-danger-foreground" role="alert">{daysBeforeError}</span> : null}
                                </label>
                                <label className="grid min-w-0 gap-1 text-sm font-medium text-content-body">
                                    เวลาแจ้งเตือน (Asia/Bangkok)
                                    <Input
                                        data-routine-field={`reminderRules.${index}.sendHour`}
                                        aria-invalid={Boolean(sendHourError)}
                                        type="time"
                                        step={3600}
                                        min="00:00"
                                        max="23:00"
                                        value={rule.sendHour}
                                        disabled={disabled}
                                        onChange={(event) => onUpdateRule(index, { sendHour: event.target.value })}
                                    />
                                    {sendHourError ? <span className="text-sm font-normal text-status-danger-foreground" role="alert">{sendHourError}</span> : null}
                                </label>
                                <label className="grid min-w-0 gap-1 text-sm font-medium text-content-body">
                                    ผู้รับการแจ้งเตือน
                                    <select
                                        className="h-11 min-w-0 rounded-md border border-input bg-background px-3 text-sm"
                                        value={rule.recipientScope}
                                        disabled={disabled}
                                        onChange={(event) => {
                                            const value = event.target.value;
                                            if (isReminderRecipientScope(value)) onUpdateRule(index, { recipientScope: value });
                                        }}
                                    >
                                        {REMINDER_SCOPE_OPTIONS.map((option) => (
                                            <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-content-body xl:justify-center">
                                    <input
                                        type="checkbox"
                                        checked={rule.isActive}
                                        disabled={disabled}
                                        onChange={(event) => onUpdateRule(index, { isActive: event.target.checked })}
                                    />
                                    เปิดใช้
                                </label>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => onRemoveRule(index)}
                                    disabled={disabled}
                                    aria-label={`ลบกฎการแจ้งเตือนที่ ${index + 1}`}
                                >
                                    <Trash2 aria-hidden="true" />
                                </Button>
                            </div>
                        );
                    })}
                </div>
            )}
        </fieldset>
    );
}
