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
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { apiPost } from "@/lib/api-client";
import { API_ROUTES, APP_ROUTES } from "@/lib/ssot/routes";
import { useAuth } from "@/components/auth/HybridAuthProvider";

// Type definitions for login
interface LoginFormData {
    email: string;
    password: string;
}

function resolveLoginErrorMessage(error: string): string {
    if (error === "Invalid email or password") {
        return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
    }
    return "เกิดข้อผิดพลาดในการเข้าสู่ระบบ";
}

export function LoginForm({
    className,
    ...props
}: React.ComponentProps<"div">) {
    const [formData, setFormData] = useState<LoginFormData>({
        email: "",
        password: "",
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();
    const searchParams = useSearchParams();
    const { refreshUser } = useAuth();

    // Check for success message from signup
    useEffect(() => {
        const message = searchParams.get("message");
        if (message) {
            toast.success("สมัครสมาชิกสำเร็จ!", {
                description: message,
            });
            // Clean URL
            router.replace(APP_ROUTES.login);
        }
    }, [searchParams, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        try {
            const result = await apiPost(API_ROUTES.auth.hybridLogin, {
                email: formData.email.trim().toLowerCase(),
                password: formData.password,
            });

            if (!result.success) {
                setError(resolveLoginErrorMessage(result.error));
                return;
            }

            await refreshUser();
            toast.success("เข้าสู่ระบบสำเร็จ!", {
                description: "ยินดีต้อนรับ! กำลังนำคุณไปยังหน้าแดชบอร์ด",
            });
            setFormData({ email: "", password: "" });
            router.push(APP_ROUTES.dashboard);
            router.refresh();
        } catch {
            setError("เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={cn("flex flex-col gap-6", className)} {...props}>
            <Card className="rounded-2xl border-gray-200/70 bg-white/90 shadow-sm">
                <CardHeader className="text-center pb-2">
                    <CardTitle className="text-2xl font-bold text-blue-700">
                        เข้าสู่ระบบ
                    </CardTitle>
                    <CardDescription className="text-gray-600">
                        กรอกอีเมลเพื่อเข้าสู่ระบบ
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit}>
                        <div className="flex flex-col gap-6">
                            {error && (
                                <div
                                    className="rounded-md bg-red-50 p-3 text-sm font-medium text-red-700"
                                    role="alert"
                                    aria-live="polite"
                                >
                                    {error}
                                </div>
                            )}

                            <div className="grid gap-3">
                                <Label
                                    htmlFor="email"
                                    className="text-gray-700"
                                >
                                    Email
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="m@example.com"
                                    autoComplete="email"
                                    spellCheck={false}
                                    value={formData.email}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            email: e.target.value,
                                        })
                                    }
                                    required
                                    aria-invalid={error ? true : undefined}
                                    className="rounded-xl border-gray-200 bg-white/70 focus:border-blue-500 focus:ring-blue-500/20"
                                />
                            </div>
                            <div className="grid gap-3">
                                <div className="flex items-center justify-between">
                                    <Label
                                        htmlFor="password"
                                        className="text-gray-700"
                                    >
                                        Password
                                    </Label>
                                    <Link
                                        href={APP_ROUTES.forgotPassword}
                                        className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
                                    >
                                        ลืมรหัสผ่าน?
                                    </Link>
                                </div>
                                <Input
                                    id="password"
                                    type="password"
                                    autoComplete="current-password"
                                    value={formData.password}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            password: e.target.value,
                                        })
                                    }
                                    required
                                    aria-invalid={error ? true : undefined}
                                    className="rounded-xl border-gray-200 bg-white/70 focus:border-blue-500 focus:ring-blue-500/20"
                                />
                            </div>
                            <div className="flex flex-col gap-3">
                                <Button
                                    type="submit"
                                    className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700 disabled:opacity-70"
                                    disabled={isLoading}
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            กำลังเข้าสู่ระบบ…
                                        </>
                                    ) : (
                                        "เข้าสู่ระบบ"
                                    )}
                                </Button>
                            </div>
                        </div>
                        <div className="mt-4 text-center text-sm">
                            ยังไม่มีบัญชี?{" "}
                            <Link
                                href={APP_ROUTES.signup}
                                className="text-blue-600 hover:text-blue-700 font-medium"
                            >
                                ลงทะเบียน
                            </Link>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
