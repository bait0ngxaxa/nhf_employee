"use client";

import {
    useMemo,
    type ChangeEvent,
    type FormEvent,
    type ReactElement,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Loader2, Mail, Send } from "lucide-react";
import { EmailRequestAccessFields } from "./EmailRequestAccessFields";
import { useEmailRequestContext } from "@/components/dashboard/context/email-request/EmailRequestContext";
import type { EmailRequestFormData } from "@/components/dashboard/context/email-request/types";
import type { SharedDriveOption } from "@/constants/email-request";

interface EmailRequestFormProps {
    onCancel?: () => void;
    onSuccess?: () => void;
}

type EmailRequestTextFieldId = Exclude<
    keyof EmailRequestFormData,
    "needsDocumentSystem" | "sharedDriveAccess"
>;

type EmailRequestFieldProps = {
    id: EmailRequestTextFieldId;
    label: string;
    value: string;
    error?: string;
    placeholder: string;
    type?: string;
    autoComplete?: string;
    inputMode?: "email" | "tel" | "text";
    maxLength?: number;
    disabled: boolean;
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
    disabled,
    onChange,
}: EmailRequestFieldProps): ReactElement {
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
                disabled={disabled}
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

    const selectedDrives = useMemo<ReadonlySet<SharedDriveOption>>(
        () => new Set(formData.sharedDriveAccess),
        [formData.sharedDriveAccess],
    );

    return (
        <div className="space-y-6">
            <Card className="rounded-2xl border-border bg-card shadow-sm">
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
                                disabled={isLoading}
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
                                disabled={isLoading}
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
                                disabled={isLoading}
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
                                disabled={isLoading}
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
                                disabled={isLoading}
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
                                disabled={isLoading}
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
                                    disabled={isLoading}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <EmailRequestAccessFields
                                needsDocumentSystem={
                                    formData.needsDocumentSystem
                                }
                                selectedDrives={selectedDrives}
                                disabled={isLoading}
                                onChange={handleInputChange}
                            />
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
                                className="h-11 rounded-xl px-8"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        กำลังส่งข้อมูล...
                                    </>
                                ) : (
                                    <>
                                        <Send className="mr-2 h-4 w-4" />
                                        ส่งคำร้อง
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>

                    <div className="mt-8 flex items-start gap-3 rounded-xl border border-primary/15 bg-primary/5 p-4">
                        <div className="flex-shrink-0 rounded-lg bg-primary/10 p-2">
                            <Mail className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground">
                                หมายเหตุ
                            </p>
                            <p className="mt-1 text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">
                                เมื่อส่งคำร้องแล้ว ทีมไอทีจะได้รับแจ้งเตือนผ่าน
                                LINE และจะดำเนินการเรื่องอีเมล ระบบสารบรรณ และ
                                Shared Drive ตามข้อมูลที่ระบุไว้
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
