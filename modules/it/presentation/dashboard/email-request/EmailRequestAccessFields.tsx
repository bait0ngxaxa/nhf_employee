import { useId, type ChangeEvent, type ReactElement } from "react";
import { SHARED_DRIVE_OPTIONS, type SharedDriveOption } from "../../../domain/email-request/constants";
import type { AccessDecision } from "../../../domain/email-request/access-requirements";

interface EmailRequestAccessFieldsProps {
    documentSystemDecision: AccessDecision;
    sharedDriveDecision: AccessDecision;
    selectedDrives: ReadonlySet<SharedDriveOption>;
    disabled?: boolean;
    error?: string;
    sharedDriveFieldId?: string;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

const choices: readonly { value: AccessDecision; label: string }[] = [
    { value: "UNDECIDED", label: "ยังไม่ทราบ" },
    { value: "NOT_REQUIRED", label: "ไม่ต้องใช้" },
    { value: "REQUIRED", label: "ต้องใช้" },
];

export function EmailRequestAccessFields({ documentSystemDecision, sharedDriveDecision,
    selectedDrives, disabled = false, error, sharedDriveFieldId, onChange }: EmailRequestAccessFieldsProps): ReactElement {
    const id = useId();
    return (
        <fieldset disabled={disabled} className="space-y-5 border-t border-border-subtle pt-6 disabled:opacity-70">
            <legend className="text-base font-semibold text-content-heading">สิทธิ์การใช้งาน</legend>
            {([
                { name: "documentSystemDecision", label: "ระบบสารบรรณ", value: documentSystemDecision },
                { name: "sharedDriveDecision", label: "Shared Drive", value: sharedDriveDecision },
            ] as const).map((field) => (
                <fieldset key={field.name} className="min-w-0 space-y-2">
                    <legend className="font-medium text-content-heading">{field.label}</legend>
                    {choices.map((choice) => (
                        <label key={choice.value} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border border-border-subtle p-3 text-sm hover:bg-surface-subtle has-[:checked]:border-brand-border-strong has-[:checked]:bg-brand-surface has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-focus">
                            <input type="radio" name={field.name} value={choice.value}
                                checked={field.value === choice.value} onChange={onChange}
                                className="mt-1 size-4 shrink-0 accent-brand-solid" />
                            <span>{choice.label}{choice.value === "UNDECIDED" && (
                                <span className="block text-content-secondary">สามารถกลับมาระบุภายหลังได้</span>
                            )}</span>
                        </label>
                    ))}
                </fieldset>
            ))}
            {sharedDriveDecision === "REQUIRED" && (
                <fieldset id={sharedDriveFieldId ?? `${id}-drives`} tabIndex={-1} aria-describedby={`${id}-help ${error ? `${id}-error` : ""}`} className="space-y-3">
                    <legend className="text-sm font-medium text-content-heading">พื้นที่ Shared Drive ที่ต้องการใช้งาน</legend>
                    <p id={`${id}-help`} className="text-sm text-content-secondary">เลือกอย่างน้อยหนึ่งรายการ (เลือกได้หลายรายการ)</p>
                    <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                        {SHARED_DRIVE_OPTIONS.map((drive) => (
                            <label key={drive} className="flex min-h-11 min-w-0 cursor-pointer items-center gap-3 rounded-md border border-border-subtle px-3 py-2 text-sm hover:bg-surface-subtle has-[:checked]:bg-brand-surface has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-focus">
                                <input type="checkbox" name="sharedDriveAccess" value={drive}
                                    checked={selectedDrives.has(drive)} onChange={onChange}
                                    className="size-4 shrink-0 accent-brand-solid" />
                                <span className="min-w-0 [overflow-wrap:anywhere]">{drive}</span>
                            </label>
                        ))}
                    </div>
                    {error && <p id={`${id}-error`} role="alert" className="text-sm text-status-error-foreground">{error}</p>}
                </fieldset>
            )}
        </fieldset>
    );
}
