import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    CheckCircle,
    XCircle,
    Clock,
    CalendarRange,
    UserCircle2,
    Briefcase,
    Thermometer,
    Palmtree,
} from "lucide-react";
import type { PendingLeave } from "@/hooks/useLeaveApprovals";

interface PendingApprovalListProps {
    pending: PendingLeave[];
    isProcessing: boolean;
    onApprove: (leaveId: string) => Promise<void>;
    onOpenReject: (leave: PendingLeave) => void;
}

const leaveTypeLabel = (leaveType: PendingLeave["leaveType"]): string => {
    if (leaveType === "SICK") return "ลาป่วย";
    if (leaveType === "PERSONAL") return "ลากิจ";
    return "ลาพักร้อน";
};

const periodLabel = (period: PendingLeave["period"]): string => {
    if (period === "FULL_DAY") return "เต็มวัน";
    if (period === "MORNING") return "เช้า";
    return "บ่าย";
};

export function PendingApprovalList({
    pending,
    isProcessing,
    onApprove,
    onOpenReject,
}: PendingApprovalListProps) {
    if (pending.length === 0) {
        return (
            <Card className="shadow-sm border-gray-100">
                <div className="p-8 text-center flex flex-col items-center text-gray-500">
                    <div className="bg-emerald-50 p-4 rounded-full mb-4">
                        <CheckCircle className="h-8 w-8 text-emerald-400" />
                    </div>
                    <p className="text-lg font-medium text-gray-700">ไม่มีคำขอที่ต้องพิจารณา</p>
                    <p className="text-sm text-gray-400 mt-1">ยอดเยี่ยม คุณตรวจสอบครบแล้ว</p>
                </div>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {pending.map((leave) => (
                <Card
                    key={leave.id}
                    className="group relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-md hover:shadow-xl hover:-translate-y-1 transition-all duration-300 hover:border-indigo-100"
                >
                    <div className="flex flex-col lg:flex-row gap-6 p-5 sm:p-6">
                        <div className="flex-1 space-y-4">
                            <div className="flex items-start justify-between">
                                <div className="flex gap-4">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-100 to-indigo-50 text-indigo-600 ring-4 ring-white shadow-sm">
                                        <UserCircle2 className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-900 text-base">
                                            {leave.employee.firstName} {leave.employee.lastName}
                                            {leave.employee.nickname ? <span className="text-gray-500 font-normal ml-1">({leave.employee.nickname})</span> : null}
                                        </h3>
                                        <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
                                            <Briefcase className="w-3.5 h-3.5" />
                                            {leave.employee.position} <span className="text-gray-300">&bull;</span> {leave.employee.dept?.name}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-xl border border-indigo-50/80 bg-indigo-50/30 p-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">ประเภทการลา</p>
                                        <div className="flex items-center text-sm font-semibold text-indigo-700">
                                            {leave.leaveType === "SICK" ? <Thermometer className="w-4 h-4 mr-1.5 text-indigo-500" /> : null}
                                            {leave.leaveType === "PERSONAL" ? <Briefcase className="w-4 h-4 mr-1.5 text-indigo-500" /> : null}
                                            {leave.leaveType === "VACATION" ? <Palmtree className="w-4 h-4 mr-1.5 text-indigo-500" /> : null}
                                            {leaveTypeLabel(leave.leaveType)}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">ระยะเวลา</p>
                                        <div className="flex items-center text-sm font-medium text-gray-900">
                                            <CalendarRange className="w-4 h-4 mr-1.5 text-gray-400" />
                                            <span>
                                                {new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short" }).format(new Date(leave.startDate))}
                                                {leave.startDate !== leave.endDate
                                                    ? ` - ${new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short" }).format(new Date(leave.endDate))}`
                                                    : ""}
                                            </span>
                                            <span className="ml-2 inline-flex items-center rounded-md bg-white px-2 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-200">
                                                {leave.durationDays} วัน ({periodLabel(leave.period)})
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                {leave.reason ? (
                                    <div className="mt-3 pt-3 border-t border-indigo-100/50">
                                        <p className="text-sm leading-relaxed text-gray-700">
                                            <span className="font-medium text-gray-900 mr-2">เหตุผล:</span>
                                            {leave.reason}
                                        </p>
                                    </div>
                                ) : null}
                            </div>

                            <div className="text-xs text-gray-400 flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" />
                                ยื่นใบลาเมื่อ{" "}
                                {new Intl.DateTimeFormat("th-TH", {
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                }).format(new Date(leave.createdAt))}
                            </div>
                        </div>

                        <div className="flex lg:flex-col justify-end gap-3 pt-4 lg:pt-0 lg:pl-6 border-t lg:border-t-0 lg:border-l border-gray-100 lg:min-w-[140px]">
                            <Button
                                onClick={() => onApprove(leave.id)}
                                disabled={isProcessing}
                                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm shadow-emerald-200 transition-all hover:shadow-md lg:hover:-translate-y-0.5"
                            >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                อนุมัติ
                            </Button>
                            <Button
                                onClick={() => onOpenReject(leave)}
                                disabled={isProcessing}
                                variant="outline"
                                className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-all"
                            >
                                <XCircle className="w-4 h-4 mr-2" />
                                ไม่อนุมัติ
                            </Button>
                        </div>
                    </div>
                </Card>
            ))}
        </div>
    );
}
