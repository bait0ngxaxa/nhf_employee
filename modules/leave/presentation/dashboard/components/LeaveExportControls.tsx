import { YearlyReportExportPanel } from "@/components/dashboard/shared/YearlyReportExportPanel";

interface LeaveExportControlsProps {
    availableYears: number[];
    exportYear: number;
    isExporting: boolean;
    onYearChange: (year: number) => void;
    onExport: () => Promise<void>;
}

export function LeaveExportControls({
    availableYears,
    exportYear,
    isExporting,
    onYearChange,
    onExport,
}: LeaveExportControlsProps) {
    return (
        <YearlyReportExportPanel
            availableYears={availableYears}
            selectedYear={exportYear}
            onYearChange={onYearChange}
            onExport={onExport}
            isExporting={isExporting}
            selectAriaLabel="เลือกปีรีพอร์ตการลา"
            layout="inline"
        />
    );
}
