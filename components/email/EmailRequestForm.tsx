"use client";

import { SuccessModal } from "@/components/SuccessModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Mail, Send } from "lucide-react";
import { useEmailRequestForm } from "@/hooks/useEmailRequestForm";

interface EmailRequestFormProps {
    onCancel?: () => void;
    onSuccess?: () => void;
}

export function EmailRequestForm({
    onCancel,
    onSuccess,
}: EmailRequestFormProps) {
    const {
        formData,
        isLoading,
        error,
        showSuccessModal,
        handleInputChange,
        handleSubmit,
        closeSuccessModal,
    } = useEmailRequestForm();

    return (
        <div className="space-y-6">
            <div className="flex items-center space-x-3">
                <div className="p-3 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-xl border border-purple-200/50">
                    <Mail className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                        ขออีเมลพนักงานใหม่
                    </h2>
                    <p className="text-gray-600">
                        กรอกข้อมูลพนักงานใหม่เพื่อขออีเมลจากทีมไอที
                    </p>
                </div>
            </div>

            <Card className="bg-white/80 backdrop-blur-xl border-gray-200/50 shadow-xl rounded-3xl">
                <CardContent className="p-6 md:p-8">
                    {error && (
                        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-center">
                            <span className="mr-2">⚠️</span>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="thaiName">
                                    ชื่อ-นามสกุล (ไทย){" "}
                                    <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="thaiName"
                                    name="thaiName"
                                    value={formData.thaiName}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="เช่น นาย สมชาย ใจดี"
                                    className="rounded-xl border-gray-200 bg-white/50 focus:bg-white"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="englishName">
                                    ชื่อ-นามสกุล (อังกฤษ){" "}
                                    <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="englishName"
                                    name="englishName"
                                    value={formData.englishName}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="e.g. Mr. Somchai Jaidee"
                                    className="rounded-xl border-gray-200 bg-white/50 focus:bg-white"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="nickname">
                                    ชื่อเล่น{" "}
                                    <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="nickname"
                                    name="nickname"
                                    value={formData.nickname}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="เช่น ชาย"
                                    className="rounded-xl border-gray-200 bg-white/50 focus:bg-white"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="phone">
                                    เบอร์โทรศัพท์{" "}
                                    <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="phone"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="เช่น 081-234-5678"
                                    className="rounded-xl border-gray-200 bg-white/50 focus:bg-white"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="position">
                                    ตำแหน่ง{" "}
                                    <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="position"
                                    name="position"
                                    value={formData.position}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="เช่น เจ้าหน้าที่บัญชี"
                                    className="rounded-xl border-gray-200 bg-white/50 focus:bg-white"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="department">
                                    สังกัด{" "}
                                    <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="department"
                                    name="department"
                                    value={formData.department}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="เช่น มสช. สพบ."
                                    className="rounded-xl border-gray-200 bg-white/50 focus:bg-white"
                                />
                            </div>

                            <div className="md:col-span-2 space-y-2">
                                <Label htmlFor="replyEmail">
                                    อีเมลที่ต้องการให้ส่งตอบกลับ{" "}
                                    <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    type="email"
                                    id="replyEmail"
                                    name="replyEmail"
                                    value={formData.replyEmail}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="ระบุอีเมลที่ต้องการให้แจ้งกลับเมื่อสำเร็จ"
                                    className="rounded-xl border-gray-200 bg-white/50 focus:bg-white"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end space-x-4 pt-4">
                            {onCancel && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={onCancel}
                                    className="px-6 rounded-xl"
                                >
                                    ยกเลิก
                                </Button>
                            )}
                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="px-8 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-500/25"
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

                    <div className="mt-8 p-4 bg-blue-50/50 border border-blue-100/50 rounded-xl flex items-start gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                            <Mail className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-blue-900">
                                หมายเหตุ
                            </p>
                            <p className="text-sm text-blue-700 mt-1">
                                เมื่อส่งคำขอแล้ว ทีมไอทีจะได้รับแจ้งเตือนผ่าน
                                LINE และจะดำเนินการสร้างอีเมลให้พนักงานใหม่ต่อไป
                                โดยจะแจ้งผลการดำเนินการกลับไปยังอีเมลที่คุณระบุไว้
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <SuccessModal
                isOpen={showSuccessModal}
                onClose={closeSuccessModal}
                title="ส่งคำขอสำเร็จ!"
                description="คำขออีเมลพนักงานใหม่ถูกส่งให้ทีมไอทีเรียบร้อยแล้ว"
                buttonText="กลับหน้าหลัก"
                onButtonClick={() => {
                    closeSuccessModal();
                    onSuccess?.();
                }}
            />
        </div>
    );
}
