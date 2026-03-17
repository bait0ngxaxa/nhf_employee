"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

import { apiGet, apiPost } from "@/lib/api-client";

type PageStatus = "validating" | "idle" | "loading" | "success" | "error";

function LeaveActionContent() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token");
    const [status, setStatus] = useState<PageStatus>("validating");
    const [message, setMessage] = useState("");
    const [actionType, setActionType] = useState<string | null>(null);

    // Auto-validate token on page load
    useEffect(() => {
        if (!token) {
            setStatus("error");
            setMessage("ลิงก์ไม่ถูกต้อง หรือไม่พบ Token สำหรับทำรายการ");
            return;
        }

        const validateToken = async () => {
            const res = await apiGet<{ valid: boolean; action: string; error?: string }>(
                `/api/leave/action?token=${encodeURIComponent(token)}`,
            );

            if (res.success && res.data.valid) {
                setActionType(res.data.action);
                setStatus("idle");
            } else {
                setStatus("error");
                setMessage(res.success ? (res.data.error ?? "Token ไม่ถูกต้อง") : res.error);
            }
        };

        validateToken();
    }, [token]);

    const handleAction = async () => {
        if (!token) return;

        setStatus("loading");
        try {
            const res = await apiPost<{ message: string }>("/api/leave/action", { token });

            if (res.success) {
                setStatus("success");
                setMessage(res.data.message || "ทำรายการสำเร็จ");
            } else {
                setStatus("error");
                setMessage(res.error || "เกิดข้อผิดพลาดในการทำรายการ");
            }
        } catch (error) {
            console.error("Action Error:", error);
            setStatus("error");
            setMessage("ระบบขัดข้อง ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
        }
    };

    const actionLabel = actionType === "approve" ? "อนุมัติ" : "ปฏิเสธ";
    const isReject = actionType === "reject";

    return (
        <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10 relative overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 font-sans">
            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200/50 rounded-full blur-3xl" />
                <div className="absolute top-1/2 -left-40 w-96 h-96 bg-purple-200/40 rounded-full blur-3xl" />
                <div className="absolute bottom-20 right-1/4 w-72 h-72 bg-cyan-200/30 rounded-full blur-3xl" />
            </div>

            <Card className="w-full max-w-md border-gray-200/50 shadow-xl shadow-gray-200/50 bg-white/80 backdrop-blur-xl rounded-3xl relative z-10">
                <CardHeader className="text-center pb-2">
                    <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">ยืนยันการทำรายการใบลา</CardTitle>
                    <CardDescription className="text-gray-500">
                        กรุณากดยืนยันเพื่อบันทึกผลการพิจารณาใบลาเข้าสู่ระบบ
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center space-y-6 pt-4">
                    {status === "validating" && (
                        <div className="flex flex-col items-center py-6 text-gray-500">
                            <Loader2 className="h-12 w-12 animate-spin mb-4 text-blue-600" />
                            <p className="text-lg font-medium">กำลังตรวจสอบลิงก์...</p>
                        </div>
                    )}

                    {status === "idle" && (
                        <div className="text-center w-full space-y-4">
                            <div className={`p-4 rounded-xl border text-sm ${isReject ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-blue-50 text-blue-700 border-blue-100"}`}>
                                คุณกำลังจะ<strong>{actionLabel}</strong>ใบลานี้
                                การดำเนินการจะถูกบันทึกเข้าสู่ประวัติใบลาของพนักงานอย่างเป็นทางการ
                            </div>
                            <Button 
                                onClick={handleAction} 
                                className={`w-full rounded-xl h-12 text-lg transition-transform hover:scale-[1.02] text-white ${isReject ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"}`}
                            >
                                ยืนยันการ{actionLabel}
                            </Button>
                        </div>
                    )}

                    {status === "loading" && (
                        <div className="flex flex-col items-center py-6 text-gray-500">
                            <Loader2 className="h-12 w-12 animate-spin mb-4 text-blue-600" />
                            <p className="text-lg font-medium">กำลังประมวลผลข้อมูลลงระบบ...</p>
                        </div>
                    )}

                    {status === "success" && (
                        <div className="flex flex-col items-center py-4 text-green-600">
                            <div className="bg-green-100 p-4 rounded-full mb-4 animate-in zoom-in duration-300">
                                <CheckCircle className="h-10 w-10 text-green-600" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">ทำรายการสำเร็จ!</h3>
                            <p className="text-center text-gray-600 font-medium">{message}</p>
                            <p className="text-sm text-gray-400 mt-4 text-center">
                                เรียบร้อยแล้ว คุณสามารถปิดหน้าต่างนี้ได้เลย
                            </p>
                        </div>
                    )}

                    {status === "error" && (
                        <div className="flex flex-col items-center py-4 text-red-600">
                            <div className="bg-red-100 p-4 rounded-full mb-4 animate-in zoom-in duration-300">
                                <XCircle className="h-10 w-10 text-red-600" />
                            </div>
                            <h3 className="text-xl font-bold mb-2">เกิดข้อผิดพลาด</h3>
                            <p className="text-center text-gray-600 font-medium">{message}</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

export default function LeaveActionPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        }>
            <LeaveActionContent />
        </Suspense>
    );
}
