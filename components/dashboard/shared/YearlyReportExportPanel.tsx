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
import { cn } from "@/lib/ui/utils";

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
            <div className="rounded-xl border border-border-subtle bg-surface-raised p-5 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                        {badge ? badge : null}
                        {(title || description) && (
                            <div>
                                {title ? (
                                    <h3 className="text-lg font-bold text-content-strong">{title}</h3>
                                ) : null}
                                {description ? (
                                    <p className="text-sm text-content-muted">{description}</p>
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
                                className="rounded-lg border border-border-subtle bg-surface-subtle p-4"
                            >
                                <div className="text-xs font-semibold text-content-muted">{stat.label}</div>
                                <div className="mt-2 text-base font-bold text-content-strong">
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
                        "w-[110px] rounded-md border-border-subtle bg-surface text-sm",
                        selectClassName,
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
                disabled={disabled || isExporting}
                aria-busy={isExporting}
                variant="outline"
                className={cn(
                    "rounded-md px-5 text-sm font-semibold",
                    buttonClassName,
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
