"use client";

import type { ChangeEvent, FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Loader2, Mail, Send } from "lucide-react";
import { useEmailRequestContext } from "@/components/dashboard/context/email-request/EmailRequestContext";
import type { EmailRequestFormData } from "@/components/dashboard/context/email-request/types";

interface EmailRequestFormProps {
    onCancel?: () => void;
    onSuccess?: () => void;
}

type EmailRequestFieldProps = {
    id: keyof EmailRequestFormData;
    label: string;
    value: string;
    error?: string;
    placeholder: string;
    type?: string;
    autoComplete?: string;
    inputMode?: "email" | "tel" | "text";
    maxLength?: number;
    onChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

function EmailRequestField({
    id,
    label,
    value,
    error,
    placeholder,
    type = "text",
    autoComplete,
    inputMode,
    maxLength,
    onChange,
}: EmailRequestFieldProps) {
    const errorId = `${id}-error`;

    return (
        <div className="min-w-0 space-y-2">
            <Label
                htmlFor={id}
                className={error ? "text-red-700 [overflow-wrap:anywhere]" : "[overflow-wrap:anywhere]"}
            >
                {label} <span className="text-red-600">*</span>
            </Label>
            <Input
                id={id}
                name={id}
                type={type}
                value={value}
                onChange={onChange}
                required
                placeholder={placeholder}
                autoComplete={autoComplete}
                inputMode={inputMode}
                maxLength={maxLength}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                className={error ? "border-red-500 focus-visible:ring-red-500" : ""}
            />
            {error ? (
                <p id={errorId} className="text-xs leading-5 text-red-700 [overflow-wrap:anywhere]">
                    {error}
                </p>
            ) : null}
        </div>
    );
}

export function EmailRequestForm({ onCancel, onSuccess }: EmailRequestFormProps) {
    const {
        formData,
        isFormLoading: isLoading,
        formError: error,
        fieldErrors,
        handleInputChange,
        handleSubmit,
    } = useEmailRequestContext();

    async function submitEmailRequest(event: FormEvent): Promise<void> {
        const isSuccess = await handleSubmit(event);
        if (isSuccess) {
            onSuccess?.();
        }
    }

    return (
        <div className="space-y-6">
            <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
                <CardContent className="p-6 md:p-8">
                    {error && (
                        <div
                            className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-800"
                            role="alert"
                            aria-live="assertive"
                        >
                            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                            <p className="text-sm leading-6 [overflow-wrap:anywhere]">
                                {error}
                            </p>
                        </div>
                    )}

                    <form onSubmit={submitEmailRequest} className="space-y-6" noValidate aria-busy={isLoading}>
                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                            <EmailRequestField
                                id="thaiName"
                                label="ชื่อ-นามสกุล (ไทย)"
                                value={formData.thaiName}
                                error={fieldErrors.thaiName}
                                placeholder="เช่น นาย สมชาย ใจดี"
                                autoComplete="name"
                                maxLength={120}
                                onChange={handleInputChange}
                            />
                            <EmailRequestField
                                id="englishName"
                                label="ชื่อ-นามสกุล (อังกฤษ)"
                                value={formData.englishName}
                                error={fieldErrors.englishName}
                                placeholder="e.g. Mr. Somchai Jaidee"
                                autoComplete="name"
                                maxLength={120}
                                onChange={handleInputChange}
                            />
                            <EmailRequestField
                                id="nickname"
                                label="ชื่อเล่น"
                                value={formData.nickname}
                                error={fieldErrors.nickname}
                                placeholder="เช่น ชาย"
                                autoComplete="nickname"
                                maxLength={80}
                                onChange={handleInputChange}
                            />
                            <EmailRequestField
                                id="phone"
                                label="เบอร์โทรศัพท์"
                                value={formData.phone}
                                error={fieldErrors.phone}
                                placeholder="เช่น 081-234-5678"
                                autoComplete="tel"
                                inputMode="tel"
                                maxLength={20}
                                onChange={handleInputChange}
                            />
                            <EmailRequestField
                                id="position"
                                label="ตำแหน่ง"
                                value={formData.position}
                                error={fieldErrors.position}
                                placeholder="เช่น เจ้าหน้าที่บัญชี"
                                autoComplete="organization-title"
                                maxLength={120}
                                onChange={handleInputChange}
                            />
                            <EmailRequestField
                                id="department"
                                label="สังกัด"
                                value={formData.department}
                                error={fieldErrors.department}
                                placeholder="เช่น มสช. สพบ."
                                autoComplete="organization"
                                maxLength={120}
                                onChange={handleInputChange}
                            />
                            <div className="md:col-span-2">
                                <EmailRequestField
                                    id="replyEmail"
                                    label="อีเมลที่ต้องการให้ส่งตอบกลับ"
                                    value={formData.replyEmail}
                                    error={fieldErrors.replyEmail}
                                    placeholder="ระบุอีเมลที่ต้องการให้แจ้งกลับเมื่อสำเร็จ"
                                    type="email"
                                    autoComplete="email"
                                    inputMode="email"
                                    maxLength={254}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>

                        <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:justify-end">
                            {onCancel && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={onCancel}
                                    className="h-11 rounded-xl px-6"
                                    disabled={isLoading}
                                >
                                    ยกเลิก
                                </Button>
                            )}
                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="h-11 rounded-xl bg-indigo-700 px-8 text-white transition-colors hover:bg-indigo-800"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        กำลังส่งข้อมูล...
                                    </>
                                ) : (
                                    <>
                                        <Send className="mr-2 h-4 w-4" />
                                        ส่งคำขอ
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>

                    <div className="mt-8 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4">
                        <div className="flex-shrink-0 rounded-lg bg-blue-100 p-2">
                            <Mail className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-blue-900">
                                หมายเหตุ
                            </p>
                            <p className="mt-1 text-sm leading-6 text-blue-800 [overflow-wrap:anywhere]">
                                เมื่อส่งคำขอแล้ว ทีมไอทีจะได้รับแจ้งเตือนผ่าน
                                LINE และจะดำเนินการสร้างอีเมลให้พนักงานใหม่ต่อไป
                                โดยจะแจ้งผลการดำเนินการกลับไปยังอีเมลที่คุณระบุไว้
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
