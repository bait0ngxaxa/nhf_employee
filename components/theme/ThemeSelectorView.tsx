"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import type { ReactElement } from "react";

import {
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

export type ThemePreference = "system" | "light" | "dark";

interface ThemeOption {
    value: ThemePreference;
    label: string;
    icon: LucideIcon;
}

const THEME_OPTIONS: readonly ThemeOption[] = [
    { value: "system", label: "ตามระบบ", icon: Monitor },
    { value: "light", label: "สว่าง", icon: Sun },
    { value: "dark", label: "มืด", icon: Moon },
];

export function isThemePreference(value: string): value is ThemePreference {
    return THEME_OPTIONS.some((option) => option.value === value);
}

interface ThemeSelectorViewProps {
    selectedTheme: ThemePreference | "";
    disabled: boolean;
    onValueChange?: (value: string) => void;
}

export function ThemeSelectorView({
    selectedTheme,
    disabled,
    onValueChange,
}: ThemeSelectorViewProps): ReactElement {
    return (
        <div role="group" aria-label="เลือกธีมการแสดงผล">
            <DropdownMenuLabel className="flex items-center gap-2 px-3 text-xs font-semibold text-content-muted">
                <Monitor className="h-4 w-4" aria-hidden="true" />
                ธีม
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
                value={selectedTheme}
                onValueChange={onValueChange}
            >
                {THEME_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    return (
                        <DropdownMenuRadioItem
                            key={option.value}
                            value={option.value}
                            disabled={disabled}
                            className="h-11 rounded-xl pl-8 font-medium text-content-body focus:bg-brand-surface focus:text-brand-strong data-[state=checked]:bg-brand-surface data-[state=checked]:text-brand-strong"
                            aria-label={`ใช้ธีม${option.label}`}
                        >
                            <Icon className="h-4 w-4" aria-hidden="true" />
                            <span>{option.label}</span>
                        </DropdownMenuRadioItem>
                    );
                })}
            </DropdownMenuRadioGroup>
        </div>
    );
}
