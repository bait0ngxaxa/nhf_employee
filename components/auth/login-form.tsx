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
import { SuccessModal } from "@/components/SuccessModal";
import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

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
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [loginSuccess, setLoginSuccess] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const router = useRouter();
    const searchParams = useSearchParams();

    // Check for success message from signup
    useEffect(() => {
        const message = searchParams.get("message");
        if (message) {
            setSuccessMessage(message);
            setShowSuccessModal(true);
            // Clean URL
            router.replace("/login");
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
                setLoginSuccess(true);
                setShowSuccessModal(true);
                // Reset form
                setFormData({ email: "", password: "" });
            }
        } catch {
            setError("เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
        } finally {
            setIsLoading(false);
        }
    };

    const handleModalClose = () => {
        setShowSuccessModal(false);
        setSuccessMessage("");
        if (loginSuccess) {
            router.push("/dashboard");
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
                                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
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
                                <div className="flex items-center">
                                    <Label
                                        htmlFor="password"
                                        className="text-gray-700"
                                    >
                                        Password
                                    </Label>
                                </div>
                                <Input
                                    id="password"
                                    type="password"
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
                                    className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg shadow-blue-500/25 transition-all duration-300 hover:scale-[1.02]"
                                    disabled={isLoading}
                                >
                                    {isLoading
                                        ? "กำลังเข้าสู่ระบบ..."
                                        : "เข้าสู่ระบบ"}
                                </Button>
                            </div>
                        </div>
                        <div className="mt-4 text-center text-sm">
                            ยังไม่มีบัญชี? ติดต่อแอดมิน
                        </div>
                    </form>
                </CardContent>
            </Card>

            <SuccessModal
                isOpen={showSuccessModal}
                onClose={handleModalClose}
                title={
                    loginSuccess ? "เข้าสู่ระบบสำเร็จ!" : "สมัครสมาชิกสำเร็จ!"
                }
                description={
                    loginSuccess
                        ? "ยินดีต้อนรับ! คุณจะถูกนำไปยังหน้าแดชบอร์ด"
                        : successMessage ||
                          "บัญชีของคุณถูกสร้างเรียบร้อยแล้ว คุณสามารถเข้าสู่ระบบได้แล้ว"
                }
                buttonText={loginSuccess ? "ไปยังแดชบอร์ด" : "เข้าสู่ระบบ"}
                onButtonClick={handleModalClose}
            />
        </div>
    );
}
