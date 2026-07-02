import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCcw, X } from "lucide-react";
import { Pagination } from "@/components/Pagination";
import type { LeaveRequest } from "@/hooks/useLeaveProfile";
import { isAfterLeaveEnd } from "@/lib/services/leave/utils";

interface LeaveHistoryMetadata {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
}

interface EmployeeLeaveHistoryListProps {
    history: LeaveRequest[];
    metadata?: LeaveHistoryMetadata;
    isSubmitting: boolean;
    onCancelRequest: (leaveId: string) => void;
    onNotTakenRequest: (leaveId: string) => void;
    onPageChange: (page: number) => void;
}

const leaveTypeLabel = (leaveType: LeaveRequest["leaveType"]): string => {
    if (leaveType === "SICK") return "ลาป่วย";
    if (leaveType === "PERSONAL") return "ลากิจ";
    return "ลาพักร้อน";
};

const periodLabel = (period: LeaveRequest["period"]): string => {
    if (period === "FULL_DAY") return "เต็มวัน";
    if (period === "MORNING") return "ช่วงเช้า";
    return "ช่วงบ่าย";
};

const statusLabel = (status: LeaveRequest["status"]): string => {
    if (status === "APPROVED") return "อนุมัติแล้ว";
    if (status === "REJECTED") return "ไม่อนุมัติ";
    if (status === "CANCELLED") return "ยกเลิก";
    if (status === "NOT_TAKEN") return "ไม่ได้ใช้วันลา";
    return "รออนุมัติ";
};

const statusClassName = (status: LeaveRequest["status"]): string => {
    if (status === "APPROVED") return "bg-emerald-100 text-emerald-700 border border-emerald-200";
    if (status === "REJECTED") return "bg-red-100 text-red-700 border border-red-200";
    if (status === "CANCELLED") return "bg-gray-100 text-gray-700 border border-gray-200";
    if (status === "NOT_TAKEN") return "bg-cyan-100 text-cyan-700 border border-cyan-200";
    return "bg-amber-100 text-amber-700 border border-amber-200";
};

export function EmployeeLeaveHistoryList({
    history,
    metadata,
    isSubmitting,
    onCancelRequest,
    onNotTakenRequest,
    onPageChange,
}: EmployeeLeaveHistoryListProps) {
    if (history.length === 0) {
        return (
            <Card className="shadow-sm border-gray-100">
                <div className="p-8 text-center text-gray-500">ยังไม่มีประวัติการยื่นใบลา</div>
            </Card>
        );
    }

    return (
        <div className="space-y-2">
            {history.map((request) => (
                <Card
                    key={request.id}
                    className="shadow-sm border-white/60 bg-white/60 backdrop-blur-sm overflow-hidden hover:shadow-md transition-shadow"
                >
                    <div className="p-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 hover:bg-white/40 transition-colors">
                        <div>
                            <div className="flex items-center space-x-2">
                                <span className="font-semibold text-gray-800 text-sm">{leaveTypeLabel(request.leaveType)}</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 shadow-sm">
                                    {periodLabel(request.period)} ({request.durationDays} วัน)
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1 font-medium">
                                วันที่: <span className="text-gray-700">{new Date(request.startDate).toLocaleDateString("th-TH")}</span>
                                {request.startDate !== request.endDate ? (
                                    <span className="text-gray-700"> - {new Date(request.endDate).toLocaleDateString("th-TH")}</span>
                                ) : null}
                            </p>
                            <p className="text-xs text-gray-500 mt-1 italic border-l-2 border-indigo-200 pl-2 leading-relaxed">
                                &quot;{request.reason}&quot;
                            </p>
                            {request.status === "REJECTED" && request.rejectReason ? (
                                <p className="text-xs text-red-600 mt-2 p-2 bg-red-50 rounded-md border border-red-100 font-medium">
                                    เหตุผล: {request.rejectReason}
                                </p>
                            ) : null}
                            {request.emergencyReason ? (
                                <p className="text-xs text-sky-700 mt-2 p-2 bg-sky-50 rounded-md border border-sky-100 font-medium">
                                    เหตุผลฉุกเฉิน: {request.emergencyReason}
                                </p>
                            ) : null}
                            {request.specialReason ? (
                                <p className="text-xs text-amber-700 mt-2 p-2 bg-amber-50 rounded-md border border-amber-100 font-medium">
                                    เหตุผลพิเศษ: {request.specialReason}
                                </p>
                            ) : null}
                            {request.notTakenRequestedAt && request.status === "APPROVED" ? (
                                <p className="text-xs text-cyan-700 mt-2 p-2 bg-cyan-50 rounded-md border border-cyan-100 font-medium">
                                    แจ้งไม่ได้ใช้วันลาแล้ว รอหัวหน้ายืนยัน: {request.notTakenReason}
                                </p>
                            ) : null}
                            {request.status === "NOT_TAKEN" && request.notTakenReason ? (
                                <p className="text-xs text-cyan-700 mt-2 p-2 bg-cyan-50 rounded-md border border-cyan-100 font-medium">
                                    โน๊ตไม่ได้ใช้วันลา: {request.notTakenReason}
                                </p>
                            ) : null}
                        </div>
                        <div className="flex items-center self-start md:self-center mt-2 md:mt-0">
                            <span
                                className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider shadow-sm ${statusClassName(request.status)}`}
                            >
                                {statusLabel(request.status)}
                            </span>
                            {request.status === "PENDING" ? (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    aria-label="ยกเลิกคำขอลา"
                                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                    title="ยกเลิกคำขอลา"
                                    disabled={isSubmitting}
                                    onClick={() => onCancelRequest(request.id)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            ) : null}
                            {canRequestNotTaken(request) ? (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    aria-label="แจ้งไม่ได้ใช้วันลา"
                                    className="h-6 w-6 p-0 text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50"
                                    title="แจ้งไม่ได้ใช้วันลา"
                                    disabled={isSubmitting}
                                    onClick={() => onNotTakenRequest(request.id)}
                                >
                                    <RotateCcw className="h-4 w-4" />
                                </Button>
                            ) : null}
                        </div>
                    </div>
                </Card>
            ))}

            {metadata && metadata.totalPages > 1 ? (
                <div className="pt-6 pb-2">
                    <Pagination
                        currentPage={metadata.currentPage}
                        totalPages={metadata.totalPages}
                        itemsPerPage={metadata.itemsPerPage}
                        onPageChange={onPageChange}
                        onPreviousPage={() => onPageChange(Math.max(1, metadata.currentPage - 1))}
                        onNextPage={() => onPageChange(Math.min(metadata.totalPages, metadata.currentPage + 1))}
                    />
                </div>
            ) : null}
        </div>
    );
}

function canRequestNotTaken(request: LeaveRequest): boolean {
    return (
        request.status === "APPROVED"
        && !request.notTakenRequestedAt
        && isAfterLeaveEnd(new Date(request.endDate))
    );
}
