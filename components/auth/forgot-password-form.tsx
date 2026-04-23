"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, CheckCircle2, Loader2 } from "lucide-react";
import { apiPost } from "@/lib/api-client";
import { API_ROUTES, APP_ROUTES } from "@/lib/ssot/routes";

export function ForgotPasswordForm({
    className,
    ...props
}: React.ComponentProps<"div">) {
    const [email, setEmail] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            const result = await apiPost(API_ROUTES.auth.forgotPassword, { email });

            if (!result.success) {
                setError(result.error);
                return;
            }

            setIsSubmitted(true);
        } catch {
            setError("เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง");
        } finally {
            setIsLoading(false);
        }
    };

    if (isSubmitted) {
        return (
            <div className={cn("flex flex-col gap-6", className)} {...props}>
                <Card className="border-gray-200/50 shadow-xl shadow-gray-200/50 bg-white/80 backdrop-blur-xl rounded-3xl">
                    <CardContent className="pt-8 pb-8">
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                                <CheckCircle2 className="h-8 w-8 text-green-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900">
                                ตรวจสอบอีเมลของคุณ
                            </h3>
                            <p className="text-sm text-gray-600 max-w-xs">
                                หากอีเมล <strong>{email}</strong> มีอยู่ในระบบ
                                คุณจะได้รับลิงก์สำหรับรีเซ็ตรหัสผ่าน
                                ลิงก์จะหมดอายุภายใน 1 ชั่วโมง
                            </p>
                            <Link
                                href={APP_ROUTES.login}
                                className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium mt-2"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                กลับไปหน้าเข้าสู่ระบบ
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className={cn("flex flex-col gap-6", className)} {...props}>
            <Card className="border-gray-200/50 shadow-xl shadow-gray-200/50 bg-white/80 backdrop-blur-xl rounded-3xl">
                <CardHeader className="text-center pb-2">
                    <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
                        <Mail className="h-6 w-6 text-blue-600" />
                    </div>
                    <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                        ลืมรหัสผ่าน
                    </CardTitle>
                    <CardDescription className="text-gray-500">
                        กรอกอีเมลเพื่อรับลิงก์รีเซ็ตรหัสผ่าน
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit}>
                        <div className="flex flex-col gap-5">
                            {error && (
                                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md" role="alert" aria-live="polite">
                                    {error}
                                </div>
                            )}

                            <div className="grid gap-3">
                                <Label
                                    htmlFor="email"
                                    className="text-gray-700"
                                >
                                    อีเมล
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="your@email.com"
                                    autoComplete="email"
                                    spellCheck={false}
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    className="rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 bg-white/50"
                                />
                            </div>

                            <Button
                                type="submit"
                                className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg shadow-blue-500/25 transition-[transform,background-color,box-shadow] duration-300 motion-safe:hover:scale-[1.02]"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        กำลังส่ง…
                                    </>
                                ) : (
                                    "ส่งลิงก์รีเซ็ตรหัสผ่าน"
                                )}
                            </Button>
                        </div>

                        <div className="mt-4 text-center">
                            <Link
                                href={APP_ROUTES.login}
                                className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 transition-colors"
                            >
                                <ArrowLeft className="h-3 w-3" />
                                กลับไปหน้าเข้าสู่ระบบ
                            </Link>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
