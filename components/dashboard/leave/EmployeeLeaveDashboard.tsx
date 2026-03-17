"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Plus,
    Loader2,
    Thermometer,
    Briefcase,
    Palmtree,
    X,
} from "lucide-react";
import { toast } from "sonner";
import { useLeaveProfile } from "@/hooks/useLeaveProfile";
import { LeaveRequestForm } from "./LeaveRequestForm";

import { Pagination } from "@/components/Pagination";

export function EmployeeLeaveDashboard() {
    const [isRequestFormOpen, setIsRequestFormOpen] = useState(false);
    const [page, setPage] = useState(1);
    const { quotas, history, metadata, isLoading, mutate, cancelLeave } =
        useLeaveProfile(page);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const getQuota = (type: "SICK" | "PERSONAL" | "VACATION") => {
        return (
            quotas.find((q) => q.leaveType === type) || {
                totalDays: 0,
                usedDays: 0,
            }
        );
    };

    const sickQuota = getQuota("SICK");
    const personalQuota = getQuota("PERSONAL");
    const vacationQuota = getQuota("VACATION");

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-800">
                    โควต้าวันลาของคุณ
                </h2>
                <Button
                    onClick={() => setIsRequestFormOpen(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                >
                    <Plus className="mr-2 h-4 w-4" /> ยื่นใบลา
                </Button>
            </div>

            {isRequestFormOpen && (
                <div className="mb-8 animate-in fade-in slide-in-from-top-4">
                    <LeaveRequestForm
                        onSuccess={() => {
                            mutate();
                            setIsRequestFormOpen(false);
                        }}
                        onCancel={() => setIsRequestFormOpen(false)}
                    />
                </div>
            )}

            <div className="grid gap-6 md:grid-cols-3">
                {/* Sick Leave Card */}
                <Card className="relative overflow-hidden bg-white/80 backdrop-blur-md border border-white/60 shadow-lg hover:shadow-xl transition-[box-shadow,transform] duration-300 rounded-3xl group">
                    <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full opacity-10 blur-2xl bg-gradient-to-br from-emerald-500 to-teal-600 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none" />
                    <CardContent className="p-5 md:p-6 relative z-10">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                    ลาป่วย (Sick Leave)
                                </p>
                                <div className="flex items-baseline space-x-2">
                                    <p className="text-3xl font-extrabold bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent tracking-tight">
                                        {Math.max(
                                            0,
                                            sickQuota.totalDays -
                                                sickQuota.usedDays,
                                        )}
                                    </p>
                                    <p className="text-sm font-medium text-gray-500">
                                        วันคงเหลือ
                                    </p>
                                </div>
                                <p className="text-xs text-gray-400 mt-1">
                                    ใช้ไปแล้ว: {sickQuota.usedDays}/
                                    {sickQuota.totalDays} วัน (โควต้า 30 วัน/ปี)
                                </p>
                            </div>
                            <div className="p-3 rounded-2xl bg-emerald-100/80 group-hover:scale-110 transition-transform duration-300">
                                <Thermometer className="h-6 w-6 text-emerald-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Personal Leave Card */}
                <Card className="relative overflow-hidden bg-white/80 backdrop-blur-md border border-white/60 shadow-lg hover:shadow-xl transition-[box-shadow,transform] duration-300 rounded-3xl group">
                    <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full opacity-10 blur-2xl bg-gradient-to-br from-blue-500 to-indigo-600 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none" />
                    <CardContent className="p-5 md:p-6 relative z-10">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                    ลากิจ (Personal Leave)
                                </p>
                                <div className="flex items-baseline space-x-2">
                                    <p className="text-3xl font-extrabold bg-gradient-to-r from-blue-500 to-indigo-600 bg-clip-text text-transparent tracking-tight">
                                        {Math.max(
                                            0,
                                            personalQuota.totalDays -
                                                personalQuota.usedDays,
                                        )}
                                    </p>
                                    <p className="text-sm font-medium text-gray-500">
                                        วันคงเหลือ
                                    </p>
                                </div>
                                <p className="text-xs text-gray-400 mt-1">
                                    ใช้ไปแล้ว: {personalQuota.usedDays}/
                                    {personalQuota.totalDays} วัน (สิทธิปีนี้)
                                </p>
                            </div>
                            <div className="p-3 rounded-2xl bg-blue-100/80 group-hover:scale-110 transition-transform duration-300">
                                <Briefcase className="h-6 w-6 text-blue-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Vacation Leave Card */}
                <Card className="relative overflow-hidden bg-white/80 backdrop-blur-md border border-white/60 shadow-lg hover:shadow-xl transition-[box-shadow,transform] duration-300 rounded-3xl group">
                    <div className="absolute -right-6 -top-6 w-32 h-32 rounded-full opacity-10 blur-2xl bg-gradient-to-br from-amber-500 to-orange-600 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none" />
                    <CardContent className="p-5 md:p-6 relative z-10">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                    ลาพักร้อน (Vacation)
                                </p>
                                <div className="flex items-baseline space-x-2">
                                    <p className="text-3xl font-extrabold bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent tracking-tight">
                                        {Math.max(
                                            0,
                                            vacationQuota.totalDays -
                                                vacationQuota.usedDays,
                                        )}
                                    </p>
                                    <p className="text-sm font-medium text-gray-500">
                                        วันคงเหลือ
                                    </p>
                                </div>
                                <p className="text-xs text-gray-400 mt-1">
                                    ใช้ไปแล้ว: {vacationQuota.usedDays}/
                                    {vacationQuota.totalDays} วัน (สิทธิปีนี้)
                                </p>
                            </div>
                            <div className="p-3 rounded-2xl bg-amber-100/80 group-hover:scale-110 transition-transform duration-300">
                                <Palmtree className="h-6 w-6 text-amber-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="mt-8">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                    ประวัติการลางาน (Recent Requests)
                </h2>
                {history.length > 0 ? (
                    <div className="space-y-2">
                        {history.map((request) => (
                            <Card
                                key={request.id}
                                className="shadow-sm border-white/60 bg-white/60 backdrop-blur-sm overflow-hidden hover:shadow-md transition-shadow"
                            >
                                <div className="p-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 hover:bg-white/40 transition-colors">
                                    <div>
                                        <div className="flex items-center space-x-2">
                                            <span className="font-semibold text-gray-800 text-sm">
                                                {request.leaveType === "SICK"
                                                    ? "ลาป่วย"
                                                    : request.leaveType ===
                                                        "PERSONAL"
                                                      ? "ลากิจ"
                                                      : "ลาพักร้อน"}
                                            </span>
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 shadow-sm">
                                                {request.period === "FULL_DAY"
                                                    ? "เต็มวัน"
                                                    : request.period ===
                                                        "MORNING"
                                                      ? "ช่วงเช้า"
                                                      : "ช่วงบ่าย"}{" "}
                                                ({request.durationDays} วัน)
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1 font-medium">
                                            วันที่:{" "}
                                            <span className="text-gray-700">
                                                {new Date(
                                                    request.startDate,
                                                ).toLocaleDateString("th-TH")}
                                            </span>
                                            {request.startDate !==
                                                request.endDate && (
                                                <span className="text-gray-700">
                                                    {" "}
                                                    -{" "}
                                                    {new Date(
                                                        request.endDate,
                                                    ).toLocaleDateString(
                                                        "th-TH",
                                                    )}
                                                </span>
                                            )}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1 italic border-l-2 border-indigo-200 pl-2 leading-relaxed">
                                            &quot;{request.reason}&quot;
                                        </p>
                                    </div>
                                    <div className="flex items-center self-start md:self-center mt-2 md:mt-0">
                                        {/* Status Badge */}
                                        <span
                                            className={`px-2.5 py-1 rounded-full text-[10px] uppercase font-bold tracking-wider shadow-sm ${
                                                request.status === "APPROVED"
                                                    ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                                    : request.status ===
                                                        "REJECTED"
                                                      ? "bg-red-100 text-red-700 border border-red-200"
                                                      : request.status ===
                                                          "CANCELLED"
                                                        ? "bg-gray-100 text-gray-700 border border-gray-200"
                                                        : "bg-amber-100 text-amber-700 border border-amber-200"
                                            }`}
                                        >
                                            {request.status === "APPROVED"
                                                ? "อนุมัติแล้ว"
                                                : request.status === "REJECTED"
                                                  ? "ไม่อนุมัติ"
                                                  : request.status ===
                                                      "CANCELLED"
                                                    ? "ยกเลิก"
                                                    : "รออนุมัติ"}
                                        </span>
                                        {request.status === "PENDING" && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                title="ยกเลิกคำขอลา"
                                                disabled={isSubmitting}
                                                onClick={async () => {
                                                    if (
                                                        window.confirm(
                                                            "คุณต้องการยกเลิกคำขอลานี้ใช่หรือไม่?",
                                                        )
                                                    ) {
                                                        try {
                                                            setIsSubmitting(
                                                                true,
                                                            );
                                                            await cancelLeave(
                                                                request.id,
                                                            );
                                                            toast.success("ยกเลิกคำขอลาเรียบร้อยแล้ว");
                                                        } catch (_err) {
                                                            toast.error(
                                                                "เกิดข้อผิดพลาดในการยกเลิกคำขอลา",
                                                            );
                                                        } finally {
                                                            setIsSubmitting(
                                                                false,
                                                            );
                                                        }
                                                    }
                                                }}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        ))}

                        {/* Pagination Controls */}
                        {metadata && metadata.totalPages > 1 && (
                            <div className="pt-6 pb-2">
                                <Pagination
                                    currentPage={metadata.currentPage}
                                    totalPages={metadata.totalPages}
                                    itemsPerPage={metadata.itemsPerPage}
                                    onPageChange={(p) => setPage(p)}
                                    onPreviousPage={() =>
                                        setPage((p) => Math.max(1, p - 1))
                                    }
                                    onNextPage={() =>
                                        setPage((p) =>
                                            Math.min(
                                                metadata.totalPages,
                                                p + 1,
                                            ),
                                        )
                                    }
                                />
                            </div>
                        )}
                    </div>
                ) : (
                    <Card className="shadow-sm border-gray-100">
                        <div className="p-8 text-center text-gray-500">
                            ยังไม่มีประวัติการยื่นใบลา
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
}
