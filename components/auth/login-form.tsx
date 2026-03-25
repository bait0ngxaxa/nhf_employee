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
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AUTH_MUTATION_HEADERS } from "@/lib/auth-csrf";
import { API_ROUTES, APP_ROUTES } from "@/lib/ssot/routes";

// Type definitions for login
interface LoginFormData {
    email: string;
    password: string;
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
            const result = await signIn("credentials", {
                email: formData.email,
                password: formData.password,
                redirect: false,
            });

            if (result?.error) {
                setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
            } else if (result?.ok) {
                await fetch(API_ROUTES.auth.bootstrap, {
                    method: "POST",
                    credentials: "include",
                    headers: AUTH_MUTATION_HEADERS,
                });
                toast.success("เข้าสู่ระบบสำเร็จ!", {
                    description: "ยินดีต้อนรับ! กำลังนำคุณไปยังหน้าแดชบอร์ด",
                });
                // Reset form
                setFormData({ email: "", password: "" });
                // Redirect to dashboard after a short delay
                setTimeout(() => {
                    router.push(APP_ROUTES.dashboard);
                }, 1500);
            }
        } catch {
            setError("เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={cn("flex flex-col gap-6", className)} {...props}>
            <Card className="border-gray-200/50 shadow-xl shadow-gray-200/50 bg-white/80 backdrop-blur-xl rounded-3xl">
                <CardHeader className="text-center pb-2">
                    <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                        เข้าสู่ระบบ
                    </CardTitle>
                    <CardDescription className="text-gray-500">
                        กรอกอีเมลเพื่อเข้าสู่ระบบ
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit}>
                        <div className="flex flex-col gap-6">
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
                                    className="rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 bg-white/50"
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
                                    className="rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 bg-white/50"
                                />
                            </div>
                            <div className="flex flex-col gap-3">
                                <Button
                                    type="submit"
                                    className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg shadow-blue-500/25 transition-[transform,background-color,box-shadow] duration-300 motion-safe:hover:scale-[1.02]"
                                    disabled={isLoading}
                                >
                                    {isLoading
                                        ? "กำลังเข้าสู่ระบบ…"
                                        : "เข้าสู่ระบบ"}
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
