import { Button } from "@/components/ui/button";
import type { RefObject } from "react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Download, Loader2 } from "lucide-react";
import { CSVLink } from "react-csv";
import { generateFilename } from "@/lib/helpers/date-helpers";
import type { LeaveExportCsvRow } from "@/lib/services/leave/client";

interface LeaveExportControlsProps {
    availableYears: number[];
    exportYear: number;
    isExporting: boolean;
    exportData: LeaveExportCsvRow[];
    csvLinkRef: RefObject<CSVLink & HTMLAnchorElement & { link: HTMLAnchorElement } | null>;
    onYearChange: (year: number) => void;
    onExport: () => Promise<void>;
}

export function LeaveExportControls({
    availableYears,
    exportYear,
    isExporting,
    exportData,
    csvLinkRef,
    onYearChange,
    onExport,
}: LeaveExportControlsProps) {
    return (
        <div className="flex items-center gap-2">
            <Select value={String(exportYear)} onValueChange={(value) => onYearChange(Number(value))}>
                <SelectTrigger className="w-[110px] h-9 text-sm">
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
            <Button onClick={onExport} disabled={isExporting} variant="outline" className="h-9 text-sm">
                {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
                ดาวน์โหลด CSV
            </Button>
            <CSVLink
                ref={csvLinkRef}
                data={exportData}
                filename={generateFilename(`รายงานการลา_ปี-${exportYear}`, "csv")}
                className="hidden"
            />
        </div>
    );
}
