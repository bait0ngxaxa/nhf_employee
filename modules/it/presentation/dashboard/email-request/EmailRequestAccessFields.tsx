import type { ChangeEvent, ReactElement } from "react";
import {
    SHARED_DRIVE_OPTIONS,
    type SharedDriveOption,
} from "../../../domain/email-request/constants";
import { cn } from "@/lib/ui/utils";

interface EmailRequestAccessFieldsProps {
    needsDocumentSystem: boolean;
    selectedDrives: ReadonlySet<SharedDriveOption>;
    disabled?: boolean;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

interface DocumentSystemToggleProps {
    checked: boolean;
    disabled?: boolean;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

interface SharedDriveChecklistProps {
    selectedDrives: ReadonlySet<SharedDriveOption>;
    disabled?: boolean;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

function DocumentSystemToggle({
    checked,
    disabled = false,
    onChange,
}: DocumentSystemToggleProps): ReactElement {
    return (
        <div className="border-b border-border-subtle pb-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <p
                        id="needsDocumentSystem-label"
                        className="font-medium text-content-heading"
                    >
                        ต้องการใช้ระบบสารบรรณ
                    </p>
                    <p
                        id="needsDocumentSystem-description"
                        className="mt-1 text-sm leading-6 text-content-secondary [overflow-wrap:anywhere]"
                    >
                        เปิดใช้เมื่อพนักงานใหม่ต้องได้รับสิทธิ์เข้าใช้งานระบบสารบรรณ
                    </p>
                </div>
                <div role="group" aria-label="ความต้องการใช้ระบบสารบรรณ" className="flex min-h-11 items-center justify-end gap-2">
                    <span className={cn(
                        "rounded-md px-2 py-1.5 text-sm transition-colors",
                        !checked ? "bg-brand-surface font-semibold text-brand-foreground" : "text-content-muted",
                    )}>
                        ไม่ต้องการ
                    </span>
                    <label
                        aria-disabled={disabled}
                        className={cn(
                            "relative inline-flex h-11 w-12 shrink-0 cursor-pointer items-center",
                            disabled && "cursor-not-allowed opacity-60",
                        )}
                    >
                        <input
                            id="needsDocumentSystem"
                            name="needsDocumentSystem"
                            type="checkbox"
                            role="switch"
                            checked={checked}
                            aria-labelledby="needsDocumentSystem-label"
                            aria-describedby="needsDocumentSystem-description"
                            disabled={disabled}
                            onChange={onChange}
                            className="peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                        />
                        <span
                            aria-hidden="true"
                            className="pointer-events-none absolute left-0 top-1/2 h-7 w-12 -translate-y-1/2 rounded-full bg-surface-muted transition-colors peer-checked:bg-brand-solid peer-focus-visible:ring-[3px] peer-focus-visible:ring-brand-focus/50"
                        />
                        <span
                            aria-hidden="true"
                            className="pointer-events-none absolute left-1 top-1/2 size-5 -translate-y-1/2 rounded-full bg-surface-raised shadow-sm transition-transform duration-200 peer-checked:translate-x-5 peer-focus-visible:ring-[3px] peer-focus-visible:ring-brand-focus/50"
                        />
                    </label>
                    <span className={cn(
                        "rounded-md px-2 py-1.5 text-sm transition-colors",
                        checked ? "bg-brand-surface font-semibold text-brand-foreground" : "text-content-muted",
                    )}>
                        ต้องการ
                    </span>
                </div>
            </div>
        </div>
    );
}

function SharedDriveChecklist({
    selectedDrives,
    disabled = false,
    onChange,
}: SharedDriveChecklistProps): ReactElement {
    const selectedCount = selectedDrives.size.toLocaleString("th-TH");
    const totalCount = SHARED_DRIVE_OPTIONS.length.toLocaleString("th-TH");

    return (
        <fieldset
            id="sharedDriveAccess"
            tabIndex={-1}
            disabled={disabled}
            aria-describedby="sharedDriveAccess-description"
            className="border-t border-border-subtle pt-5 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-70"
        >
            <legend className="px-1 text-sm font-medium text-content-heading">
                พื้นที่ Shared Drive ที่ต้องการใช้งาน
            </legend>
            <p
                id="sharedDriveAccess-description"
                className="mt-2 text-sm leading-6 text-content-secondary [overflow-wrap:anywhere]"
            >
                เลือกได้หลายรายการ, เลือกแล้ว {selectedCount} จาก {totalCount} รายการ
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {SHARED_DRIVE_OPTIONS.map((drive) => (
                    <label
                        key={drive}
                        aria-disabled={disabled}
                        className={cn(
                            "flex min-h-11 min-w-0 cursor-pointer items-center gap-3 rounded-md border border-border-subtle bg-surface-raised px-3 py-2 text-sm font-medium text-content-heading transition-colors hover:bg-surface-subtle has-[:checked]:border-brand-border-strong has-[:checked]:bg-brand-surface has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-brand-focus/50",
                            disabled && "cursor-not-allowed opacity-70",
                        )}
                    >
                        <input
                            type="checkbox"
                            name="sharedDriveAccess"
                            value={drive}
                            checked={selectedDrives.has(drive)}
                            disabled={disabled}
                            onChange={onChange}
                            className="size-4 shrink-0 rounded border-border-subtle accent-brand-solid focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-focus/50 disabled:cursor-not-allowed"
                        />
                        <span className="min-w-0 [overflow-wrap:anywhere]">
                            {drive}
                        </span>
                    </label>
                ))}
            </div>
        </fieldset>
    );
}

export function EmailRequestAccessFields({
    needsDocumentSystem,
    selectedDrives,
    disabled = false,
    onChange,
}: EmailRequestAccessFieldsProps): ReactElement {
    return (
        <fieldset className="space-y-5 border-t border-border-subtle pt-6">
            <legend className="text-base font-semibold text-content-heading">
                สิทธิ์การใช้งาน
            </legend>
            <DocumentSystemToggle
                checked={needsDocumentSystem}
                disabled={disabled}
                onChange={onChange}
            />
            <SharedDriveChecklist
                selectedDrives={selectedDrives}
                disabled={disabled}
                onChange={onChange}
            />
        </fieldset>
    );
}
