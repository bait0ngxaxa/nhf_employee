import type { ChangeEvent, ReactElement } from "react";
import {
    SHARED_DRIVE_OPTIONS,
    type SharedDriveOption,
} from "@/constants/email-request";
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
        <div className="rounded-xl border border-border bg-muted/40 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <p
                        id="needsDocumentSystem-label"
                        className="font-medium text-foreground"
                    >
                        ต้องการใช้ระบบสารบรรณ
                    </p>
                    <p
                        id="needsDocumentSystem-description"
                        className="mt-1 text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]"
                    >
                        เปิดใช้เมื่อพนักงานใหม่ต้องได้รับสิทธิ์เข้าใช้งานระบบสารบรรณ
                    </p>
                </div>
                <label
                    htmlFor="needsDocumentSystem"
                    aria-disabled={disabled}
                    className={cn(
                        "relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full bg-muted-foreground/35 transition-colors has-[:checked]:bg-primary has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                        disabled && "cursor-not-allowed opacity-60",
                    )}
                >
                    <span className="sr-only">ต้องการใช้ระบบสารบรรณ</span>
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
                        className="peer sr-only"
                    />
                    <span className="ml-1 h-5 w-5 translate-x-0 rounded-full bg-white shadow-sm transition-transform duration-200 peer-checked:translate-x-5" />
                </label>
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
            className="rounded-xl border border-border p-4 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-70"
        >
            <legend className="px-1 text-sm font-medium text-foreground">
                Shared Drive ที่ต้องการใช้งาน
            </legend>
            <p
                id="sharedDriveAccess-description"
                className="mt-2 text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]"
            >
                เลือกได้หลายรายการ, เลือกแล้ว {selectedCount} จาก {totalCount} รายการ
            </p>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {SHARED_DRIVE_OPTIONS.map((drive) => (
                    <label
                        key={drive}
                        aria-disabled={disabled}
                        className={cn(
                            "flex min-h-11 min-w-0 cursor-pointer items-center gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
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
                            className="size-4 shrink-0 rounded border-border accent-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed"
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
        <div className="md:col-span-2 space-y-4">
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
        </div>
    );
}
