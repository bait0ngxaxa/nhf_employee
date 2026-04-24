"use client";

import type { ReactNode } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type YearlyReportExportPanelProps = {
    availableYears: number[];
    selectedYear: number;
    onYearChange: (year: number) => void;
    onExport: () => void | Promise<void>;
    isExporting: boolean;
    disabled?: boolean;
    exportLabel?: string;
    selectAriaLabel?: string;
    layout?: "inline" | "card";
    title?: string;
    description?: string;
    badge?: ReactNode;
    stats?: Array<{
        icon?: ReactNode;
        label: string;
        value: string;
    }>;
    selectClassName?: string;
    buttonClassName?: string;
};

export function YearlyReportExportPanel({
    availableYears,
    selectedYear,
    onYearChange,
    onExport,
    isExporting,
    disabled = false,
    exportLabel = "ดาวน์โหลด CSV",
    selectAriaLabel = "เลือกปีรีพอร์ต",
    layout = "inline",
    title,
    description,
    badge,
    stats = [],
    selectClassName,
    buttonClassName,
}: YearlyReportExportPanelProps) {
    if (layout === "card") {
        return (
            <div className="rounded-[1.9rem] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(248,250,252,0.98),rgba(255,247,237,0.9))] p-5 shadow-[0_24px_60px_-34px_rgba(15,23,42,0.28)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                        {badge ? badge : null}
                        {(title || description) && (
                            <div>
                                {title ? (
                                    <h3 className="text-lg font-bold text-slate-800">{title}</h3>
                                ) : null}
                                {description ? (
                                    <p className="text-sm text-slate-500">{description}</p>
                                ) : null}
                            </div>
                        )}
                    </div>

                    <PanelControls
                        availableYears={availableYears}
                        selectedYear={selectedYear}
                        onYearChange={onYearChange}
                        onExport={onExport}
                        isExporting={isExporting}
                        disabled={disabled}
                        exportLabel={exportLabel}
                        selectAriaLabel={selectAriaLabel}
                        className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)] lg:min-w-[360px]"
                        selectClassName={selectClassName}
                        buttonClassName={buttonClassName}
                    />
                </div>

                {stats.length > 0 ? (
                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                        {stats.map((stat) => (
                            <div
                                key={stat.label}
                                className="rounded-2xl border border-white/80 bg-white/90 p-4 shadow-sm"
                            >
                                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                    {stat.icon}
                                    {stat.label}
                                </div>
                                <div className="mt-2 text-base font-bold text-slate-800">
                                    {stat.value}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : null}
            </div>
        );
    }

    return (
        <PanelControls
            availableYears={availableYears}
            selectedYear={selectedYear}
            onYearChange={onYearChange}
            onExport={onExport}
            isExporting={isExporting}
            disabled={disabled}
            exportLabel={exportLabel}
            selectAriaLabel={selectAriaLabel}
            className="flex items-center gap-2"
            selectClassName={selectClassName}
            buttonClassName={buttonClassName}
        />
    );
}

function PanelControls({
    availableYears,
    selectedYear,
    onYearChange,
    onExport,
    isExporting,
    disabled,
    exportLabel,
    selectAriaLabel,
    className,
    selectClassName,
    buttonClassName,
}: {
    availableYears: number[];
    selectedYear: number;
    onYearChange: (year: number) => void;
    onExport: () => void | Promise<void>;
    isExporting: boolean;
    disabled: boolean;
    exportLabel: string;
    selectAriaLabel: string;
    className: string;
    selectClassName?: string;
    buttonClassName?: string;
}) {
    return (
        <div className={className}>
            <Select
                value={String(selectedYear)}
                onValueChange={(value) => onYearChange(Number(value))}
                disabled={isExporting}
            >
                <SelectTrigger
                    className={cn(
                        "w-[110px] rounded-2xl border-slate-200 bg-white/90 text-sm shadow-sm",
                        selectClassName ?? "h-9",
                    )}
                    aria-label={selectAriaLabel}
                >
                    <SelectValue placeholder="เลือกปี" />
                </SelectTrigger>
                <SelectContent>
                    {availableYears.map((year) => (
                        <SelectItem key={year} value={String(year)}>
                            {year}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Button
                type="button"
                onClick={onExport}
                disabled={disabled}
                variant="outline"
                className={cn(
                    "rounded-2xl px-5 text-sm font-semibold",
                    buttonClassName ?? "h-9",
                )}
            >
                {isExporting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                    <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                {exportLabel}
            </Button>
        </div>
    );
}
