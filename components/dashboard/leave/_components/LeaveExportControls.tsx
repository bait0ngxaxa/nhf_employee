import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Download, Loader2 } from "lucide-react";

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
        </div>
    );
}
