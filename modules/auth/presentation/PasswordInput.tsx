"use client";

import { useState } from "react";
import type { ComponentProps, ReactElement } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/ui/utils";

type PasswordInputProps = Omit<ComponentProps<typeof Input>, "type"> & {
    readonly showLabel?: string;
    readonly hideLabel?: string;
};

export function PasswordInput({
    className,
    showLabel = "แสดงรหัสผ่าน",
    hideLabel = "ซ่อนรหัสผ่าน",
    ...props
}: PasswordInputProps): ReactElement {
    const [visible, setVisible] = useState(false);

    return (
        <div className="relative">
            <Input
                {...props}
                type={visible ? "text" : "password"}
                className={cn("pr-14 sm:pr-11", className)}
            />
            <button
                type="button"
                onClick={() => setVisible((current) => !current)}
                aria-label={visible ? hideLabel : showLabel}
                aria-pressed={visible}
                disabled={props.disabled}
                className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-md text-content-neutral-muted hover:bg-action-primary-surface hover:text-action-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action-primary-focus/40 disabled:pointer-events-none disabled:opacity-50 sm:right-2 sm:h-8 sm:w-8"
            >
                {visible ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                )}
            </button>
        </div>
    );
}
