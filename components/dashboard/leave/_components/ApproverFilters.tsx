import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import type { ApproverEmployeeItem } from "@/lib/services/leave/client";

interface ApproverFiltersProps {
    search: string;
    filterApprover: string;
    activeApprovers: ApproverEmployeeItem[];
    formatName: (employee: { firstName: string; lastName: string; nickname: string | null }) => string;
    onSearchChange: (value: string) => void;
    onFilterChange: (value: string) => void;
}

export function ApproverFilters({
    search,
    filterApprover,
    activeApprovers,
    formatName,
    onSearchChange,
    onFilterChange,
}: ApproverFiltersProps) {
    return (
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                    placeholder="ค้นหาชื่อ อีเมล หรือแผนก"
                    value={search}
                    onChange={(event) => onSearchChange(event.target.value)}
                    className="pl-9"
                />
            </div>
            <Select value={filterApprover} onValueChange={onFilterChange}>
                <SelectTrigger className="w-full sm:w-[220px]">
                    <SelectValue placeholder="กรองตามผู้อนุมัติ" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">ทั้งหมด</SelectItem>
                    <SelectItem value="unassigned">ยังไม่กำหนด</SelectItem>
                    {activeApprovers.map((approver) => (
                        <SelectItem key={approver.id} value={String(approver.id)}>
                            {formatName(approver)}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
