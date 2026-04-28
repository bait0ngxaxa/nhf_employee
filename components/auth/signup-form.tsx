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
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useTitle } from "@/hooks/useTitle";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { apiPost } from "@/lib/api-client";
import { API_ROUTES, APP_ROUTES } from "@/lib/ssot/routes";

// Type definitions for API response
interface User {
    id: number;
    name: string;
    email: string;
    role: string;
}

interface SignupSuccessResponse {
    message: string;
    user: User;
}

export function SignupForm({
    className,
    ...props
}: React.ComponentProps<"div">) {
    const [formData, setFormData] = useState({
        email: "",
        password: "",
        confirmPassword: "",
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const router = useRouter();
    useTitle("สมัครสมาชิก | NHFapp");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        // Validation
        if (!formData.email.endsWith("@thainhf.org")) {
            setError("กรุณาใช้อีเมลองค์กร (@thainhf.org) เท่านั้น");
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setError("รหัสผ่านไม่ตรงกัน");
            return;
        }

        if (formData.password.length < 6) {
            setError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
            return;
        }

        setIsLoading(true);

        try {
            const result = await apiPost<SignupSuccessResponse>(
                API_ROUTES.auth.signup,
                {
                    email: formData.email,
                    password: formData.password,
                    confirmPassword: formData.confirmPassword,
                },
            );

            if (result.success) {
                const data = result.data;

                // Step 1: Create NextAuth session (for useSession() on client)
                const signInResult = await signIn("credentials", {
                    email: formData.email.trim().toLowerCase(),
                    password: formData.password,
                    redirect: false,
                });

                if (signInResult?.error) {
                    setError("สมัครสมาชิกสำเร็จ แต่เข้าสู่ระบบอัตโนมัติล้มเหลว กรุณาเข้าสู่ระบบด้วยตนเอง");
                    return;
                }

                // Hybrid auth session is bootstrapped automatically by
                // DashboardProvider when the dashboard mounts, so we only
                // need the NextAuth session established above.

                toast.success("สมัครสมาชิกสำเร็จ!", {
                    description: `ยินดีต้อนรับ${data.user?.name ? ` ${data.user.name}` : ""}! บัญชีของคุณถูกสร้างเรียบร้อยแล้ว`,
                });
                setFormData({
                    email: "",
                    password: "",
                    confirmPassword: "",
                });
                router.push(APP_ROUTES.dashboard);
                router.refresh();
            } else {
                setError(result.error);
            }
        } catch {
            setError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={cn("flex flex-col gap-6", className)} {...props}>
            <Card className="border-gray-200/50 shadow-xl shadow-gray-200/50 bg-white/80 backdrop-blur-xl rounded-3xl">
                <CardHeader className="text-center pb-2">
                    <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                        สร้างบัญชีใหม่
                    </CardTitle>
                    <CardDescription className="text-gray-500">
                        ใช้อีเมลองค์กรของคุณเพื่อลงทะเบียน ระบบจะดึงชื่อจากข้อมูลพนักงานให้อัตโนมัติ
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
                                    อีเมล
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="example@thainhf.org"
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
                                <Label
                                    htmlFor="password"
                                    className="text-gray-700"
                                >
                                    รหัสผ่าน
                                </Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="กรอกรหัสผ่าน"
                                    autoComplete="new-password"
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

                            <div className="grid gap-3">
                                <Label
                                    htmlFor="confirmPassword"
                                    className="text-gray-700"
                                >
                                    ยืนยันรหัสผ่าน
                                </Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    placeholder="กรอกรหัสผ่านอีกครั้ง"
                                    autoComplete="new-password"
                                    value={formData.confirmPassword}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            confirmPassword: e.target.value,
                                        })
                                    }
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
                                        กำลังลงทะเบียน…
                                    </>
                                ) : (
                                    "ลงทะเบียน"
                                )}
                            </Button>
                        </div>

                        <div className="mt-4 text-center text-sm">
                            มีบัญชีอยู่แล้ว?{" "}
                            <Link
                                href={APP_ROUTES.login}
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
