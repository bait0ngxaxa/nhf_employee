"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

function LeaveActionContent() {
    const searchParams = useSearchParams();
    const token = searchParams.get("token");
    const [status, setStatus] = useState<"loading" | "success" | "error" | "idle">("idle");
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (!token) {
            setStatus("error");
            setMessage("ลิงก์ไม่ถูกต้อง หรือไม่พบ Token สำหรับทำรายการ");
        }
    }, [token]);

    const handleAction = async () => {
        if (!token) return;

        setStatus("loading");
        try {
            const res = await fetch("/api/leave/action", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token }),
            });
            const data = await res.json();

            if (res.ok && data.success) {
                setStatus("success");
                setMessage(data.message || "ทำรายการสำเร็จ");
            } else {
                setStatus("error");
                setMessage(data.error || "เกิดข้อผิดพลาดในการทำรายการ");
            }
        } catch (error) {
            console.error("Action Error:", error);
            setStatus("error");
            setMessage("ระบบขัดข้อง ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans">
            <Card className="w-full max-w-md shadow-lg border-t-4 border-t-blue-600">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold text-gray-800">ยืนยันการทำรายการใบลา</CardTitle>
                    <CardDescription className="text-gray-500">
                        กรุณากดยืนยันเพื่อบันทึกผลการพิจารณาใบลาเข้าสู่ระบบ
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center space-y-6">
                    {status === "idle" && (
                        <div className="text-center w-full space-y-4">
                            <div className="bg-blue-50 text-blue-700 p-4 rounded-xl border border-blue-100 text-sm">
                                การดำเนินการนี้จะถูกบันทึกเข้าสูประวัติใบลาของพนักงานอย่างเป็นทางการ
                            </div>
                            <Button 
                                onClick={handleAction} 
                                className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 h-12 text-lg transition-transform hover:scale-[1.02]"
                            >
                                ยืนยันการทำรายการ
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
                            {message !== "ลิงก์ไม่ถูกต้อง หรือไม่พบ Token สำหรับทำรายการ" && (
                                <Button 
                                    variant="outline" 
                                    onClick={() => setStatus("idle")}
                                    className="mt-6 w-full rounded-xl hover:bg-gray-100"
                                >
                                    ลองใหม่อีกครั้ง
                                </Button>
                            )}
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
