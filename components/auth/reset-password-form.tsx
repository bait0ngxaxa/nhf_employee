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
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { KeyRound, Eye, EyeOff, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";

interface PasswordRequirement {
    label: string;
    test: (password: string) => boolean;
}

const PASSWORD_REQUIREMENTS: PasswordRequirement[] = [
    { label: "อย่างน้อย 8 ตัวอักษร", test: (p) => p.length >= 8 },
    { label: "มีตัวพิมพ์เล็ก (a-z)", test: (p) => /[a-z]/.test(p) },
    { label: "มีตัวพิมพ์ใหญ่ (A-Z)", test: (p) => /[A-Z]/.test(p) },
    { label: "มีตัวเลข (0-9)", test: (p) => /\d/.test(p) },
];

export function ResetPasswordForm({
    className,
    ...props
}: React.ComponentProps<"div">) {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();
    const searchParams = useSearchParams();

    const token = searchParams.get("token");

    const handleSubmit = async (e: React.FormEvent): Promise<void> => {
        e.preventDefault();
        setError("");

        if (!token) {
            setError("ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้อง");
            return;
        }

        if (password !== confirmPassword) {
            setError("รหัสผ่านไม่ตรงกัน");
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch("/api/auth/reset-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token, password, confirmPassword }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
                return;
            }

            toast.success("รีเซ็ตรหัสผ่านสำเร็จ!", {
                description: "กำลังนำคุณไปยังหน้าเข้าสู่ระบบ",
            });

            setTimeout(() => {
                router.push(
                    "/login?message=รีเซ็ตรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่",
                );
            }, 1500);
        } catch {
            setError("เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง");
        } finally {
            setIsLoading(false);
        }
    };

    if (!token) {
        return (
            <div className={cn("flex flex-col gap-6", className)} {...props}>
                <Card className="border-gray-200/50 shadow-xl shadow-gray-200/50 bg-white/80 backdrop-blur-xl rounded-3xl">
                    <CardContent className="pt-8 pb-8">
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                                <XCircle className="h-8 w-8 text-red-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900">
                                ลิงก์ไม่ถูกต้อง
                            </h3>
                            <p className="text-sm text-gray-600">
                                ลิงก์รีเซ็ตรหัสผ่านไม่ถูกต้องหรือหมดอายุแล้ว
                            </p>
                            <Link
                                href="/forgot-password"
                                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                            >
                                ขอลิงก์รีเซ็ตรหัสผ่านใหม่
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
                        <KeyRound className="h-6 w-6 text-blue-600" />
                    </div>
                    <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                        ตั้งรหัสผ่านใหม่
                    </CardTitle>
                    <CardDescription className="text-gray-500">
                        กรอกรหัสผ่านใหม่ที่ต้องการใช้งาน
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit}>
                        <div className="flex flex-col gap-5">
                            {error && (
                                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                                    {error}
                                </div>
                            )}

                            <div className="grid gap-3">
                                <Label
                                    htmlFor="password"
                                    className="text-gray-700"
                                >
                                    รหัสผ่านใหม่
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={
                                            showPassword ? "text" : "password"
                                        }
                                        value={password}
                                        onChange={(e) =>
                                            setPassword(e.target.value)
                                        }
                                        required
                                        className="rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 bg-white/50 pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowPassword(!showPassword)
                                        }
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            {/* Password Requirements */}
                            {password.length > 0 && (
                                <div className="space-y-1.5">
                                    {PASSWORD_REQUIREMENTS.map((req) => {
                                        const passed = req.test(password);
                                        return (
                                            <div
                                                key={req.label}
                                                className="flex items-center gap-2 text-xs"
                                            >
                                                {passed ? (
                                                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                                ) : (
                                                    <XCircle className="h-3.5 w-3.5 text-gray-300" />
                                                )}
                                                <span
                                                    className={
                                                        passed
                                                            ? "text-green-600"
                                                            : "text-gray-400"
                                                    }
                                                >
                                                    {req.label}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="grid gap-3">
                                <Label
                                    htmlFor="confirmPassword"
                                    className="text-gray-700"
                                >
                                    ยืนยันรหัสผ่านใหม่
                                </Label>
                                <div className="relative">
                                    <Input
                                        id="confirmPassword"
                                        type={
                                            showConfirmPassword
                                                ? "text"
                                                : "password"
                                        }
                                        value={confirmPassword}
                                        onChange={(e) =>
                                            setConfirmPassword(e.target.value)
                                        }
                                        required
                                        className="rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 bg-white/50 pr-10"
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setShowConfirmPassword(
                                                !showConfirmPassword,
                                            )
                                        }
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        {showConfirmPassword ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                                {confirmPassword.length > 0 &&
                                    password !== confirmPassword && (
                                        <p className="text-xs text-red-500">
                                            รหัสผ่านไม่ตรงกัน
                                        </p>
                                    )}
                            </div>

                            <Button
                                type="submit"
                                className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg shadow-blue-500/25 transition-all duration-300 hover:scale-[1.02]"
                                disabled={isLoading}
                            >
                                {isLoading
                                    ? "กำลังบันทึก..."
                                    : "ตั้งรหัสผ่านใหม่"}
                            </Button>
                        </div>

                        <div className="mt-4 text-center text-sm text-gray-500">
                            จำรหัสผ่านได้แล้ว?{" "}
                            <Link
                                href="/login"
                                className="text-blue-600 hover:text-blue-700 font-medium"
                            >
                                เข้าสู่ระบบ
                            </Link>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
