"use client";

import { useState, useEffect } from "react";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { SuccessModal } from "@/components/SuccessModal";
import {
    type AddEmployeeFormProps,
    type EmployeeFormData,
    type Department,
} from "@/types/employees";

import { createEmployeeSchema } from "@/lib/validations/employee";

export function AddEmployeeForm({ onSuccess }: AddEmployeeFormProps) {
    const [formData, setFormData] = useState<EmployeeFormData>({
        firstName: "",
        lastName: "",
        nickname: "",
        email: "",
        phone: "",
        position: "",
        affiliation: "",
        departmentId: "",
    });

    const [departments, setDepartments] = useState<Department[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    useEffect(() => {
        const fetchDepartments = async () => {
            try {
                const response = await fetch("/api/departments");
                if (response.ok) {
                    const data = await response.json();
                    setDepartments(data.departments);
                }
            } catch (error) {
                console.error("Error fetching departments:", error);
            }
        };

        fetchDepartments();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setFieldErrors({});

        // Client-side validation
        const result = createEmployeeSchema.safeParse(formData);

        if (!result.success) {
            const errors: Record<string, string> = {};
            let firstErrorField = "";

            result.error.issues.forEach((issue) => {
                const fieldName = issue.path[0] as string;
                if (!errors[fieldName]) {
                    errors[fieldName] = issue.message;
                    if (!firstErrorField) firstErrorField = fieldName;
                }
            });

            setFieldErrors(errors);

            if (firstErrorField) {
                const element = document.getElementById(firstErrorField);
                if (element) {
                    element.scrollIntoView({
                        behavior: "smooth",
                        block: "center",
                    });
                    element.focus();
                }
            }
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch("/api/employees", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                setShowSuccessModal(true);
            } else {
                const data = await response.json();
                setError(data.error || "เกิดข้อผิดพลาดในการเพิ่มพนักงาน");
            }
        } catch {
            setError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
        } finally {
            setIsLoading(false);
        }
    };

    const handleModalClose = () => {
        setShowSuccessModal(false);
        setFormData({
            firstName: "",
            lastName: "",
            nickname: "",
            email: "",
            phone: "",
            position: "",
            affiliation: "",
            departmentId: "",
        });
        setFieldErrors({});
        onSuccess?.();
    };

    return (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>เพิ่มพนักงานใหม่</CardTitle>
                    <CardDescription>
                        กรอกข้อมูลพนักงานใหม่เพื่อเพิ่มเข้าระบบ
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} noValidate>
                        <div className="flex flex-col gap-6">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="grid gap-3">
                                    <Label
                                        htmlFor="firstName"
                                        className={
                                            fieldErrors.firstName
                                                ? "text-red-500"
                                                : ""
                                        }
                                    >
                                        ชื่อ
                                    </Label>
                                    <Input
                                        id="firstName"
                                        type="text"
                                        placeholder="ชื่อจริง"
                                        value={formData.firstName}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                firstName: e.target.value,
                                            })
                                        }
                                        className={
                                            fieldErrors.firstName
                                                ? "border-red-500 focus-visible:ring-red-500"
                                                : ""
                                        }
                                    />
                                    {fieldErrors.firstName && (
                                        <p className="text-xs text-red-500">
                                            {fieldErrors.firstName}
                                        </p>
                                    )}
                                </div>
                                <div className="grid gap-3">
                                    <Label
                                        htmlFor="lastName"
                                        className={
                                            fieldErrors.lastName
                                                ? "text-red-500"
                                                : ""
                                        }
                                    >
                                        นามสกุล
                                    </Label>
                                    <Input
                                        id="lastName"
                                        type="text"
                                        placeholder="นามสกุล"
                                        value={formData.lastName}
                                        onChange={(e) =>
                                            setFormData({
                                                ...formData,
                                                lastName: e.target.value,
                                            })
                                        }
                                        className={
                                            fieldErrors.lastName
                                                ? "border-red-500 focus-visible:ring-red-500"
                                                : ""
                                        }
                                    />
                                    {fieldErrors.lastName && (
                                        <p className="text-xs text-red-500">
                                            {fieldErrors.lastName}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="grid gap-3">
                                <Label
                                    htmlFor="nickname"
                                    className={
                                        fieldErrors.nickname
                                            ? "text-red-500"
                                            : ""
                                    }
                                >
                                    ชื่อเล่น (ไม่บังคับ)
                                </Label>
                                <Input
                                    id="nickname"
                                    type="text"
                                    placeholder="ชื่อเล่นที่ใช้ในชีวิตประจำวัน"
                                    value={formData.nickname}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            nickname: e.target.value,
                                        })
                                    }
                                    className={
                                        fieldErrors.nickname
                                            ? "border-red-500 focus-visible:ring-red-500"
                                            : ""
                                    }
                                />
                                {fieldErrors.nickname && (
                                    <p className="text-xs text-red-500">
                                        {fieldErrors.nickname}
                                    </p>
                                )}
                            </div>

                            <div className="grid gap-3">
                                <Label
                                    htmlFor="email"
                                    className={
                                        fieldErrors.email ? "text-red-500" : ""
                                    }
                                >
                                    อีเมล
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="example@company.com"
                                    value={formData.email}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            email: e.target.value,
                                        })
                                    }
                                    className={
                                        fieldErrors.email
                                            ? "border-red-500 focus-visible:ring-red-500"
                                            : ""
                                    }
                                />
                                {fieldErrors.email && (
                                    <p className="text-xs text-red-500">
                                        {fieldErrors.email}
                                    </p>
                                )}
                            </div>

                            <div className="grid gap-3">
                                <Label
                                    htmlFor="phone"
                                    className={
                                        fieldErrors.phone ? "text-red-500" : ""
                                    }
                                >
                                    เบอร์โทรศัพท์
                                </Label>
                                <Input
                                    id="phone"
                                    type="tel"
                                    placeholder="081-234-5678"
                                    value={formData.phone}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            phone: e.target.value,
                                        })
                                    }
                                    className={
                                        fieldErrors.phone
                                            ? "border-red-500 focus-visible:ring-red-500"
                                            : ""
                                    }
                                />
                                {fieldErrors.phone && (
                                    <p className="text-xs text-red-500">
                                        {fieldErrors.phone}
                                    </p>
                                )}
                            </div>

                            <div className="grid gap-3">
                                <Label
                                    htmlFor="position"
                                    className={
                                        fieldErrors.position
                                            ? "text-red-500"
                                            : ""
                                    }
                                >
                                    ตำแหน่ง
                                </Label>
                                <Input
                                    id="position"
                                    type="text"
                                    placeholder="เช่น ผู้จัดการ, อาจารย์, นักวิชาการ"
                                    value={formData.position}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            position: e.target.value,
                                        })
                                    }
                                    className={
                                        fieldErrors.position
                                            ? "border-red-500 focus-visible:ring-red-500"
                                            : ""
                                    }
                                />
                                {fieldErrors.position && (
                                    <p className="text-xs text-red-500">
                                        {fieldErrors.position}
                                    </p>
                                )}
                            </div>

                            <div className="grid gap-3">
                                <Label
                                    htmlFor="affiliation"
                                    className={
                                        fieldErrors.affiliation
                                            ? "text-red-500"
                                            : ""
                                    }
                                >
                                    สังกัด
                                </Label>
                                <Input
                                    id="affiliation"
                                    type="text"
                                    placeholder="เช่น มสช. สพบ. หรืออื่นๆ"
                                    value={formData.affiliation}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            affiliation: e.target.value,
                                        })
                                    }
                                    className={
                                        fieldErrors.affiliation
                                            ? "border-red-500 focus-visible:ring-red-500"
                                            : ""
                                    }
                                />
                                {fieldErrors.affiliation && (
                                    <p className="text-xs text-red-500">
                                        {fieldErrors.affiliation}
                                    </p>
                                )}
                            </div>

                            <div className="grid gap-3">
                                <Label
                                    htmlFor="departmentId"
                                    className={
                                        fieldErrors.departmentId
                                            ? "text-red-500"
                                            : ""
                                    }
                                >
                                    แผนก
                                </Label>
                                <Select
                                    value={String(formData.departmentId)}
                                    onValueChange={(value) =>
                                        setFormData({
                                            ...formData,
                                            departmentId: value,
                                        })
                                    }
                                >
                                    <SelectTrigger
                                        id="departmentId"
                                        className={
                                            fieldErrors.departmentId
                                                ? "border-red-500 focus:ring-red-500"
                                                : ""
                                        }
                                    >
                                        <SelectValue placeholder="เลือกแผนก" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {departments.map((dept) => (
                                            <SelectItem
                                                key={dept.id}
                                                value={dept.id.toString()}
                                            >
                                                {dept.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {fieldErrors.departmentId && (
                                    <p className="text-xs text-red-500">
                                        {fieldErrors.departmentId}
                                    </p>
                                )}
                            </div>

                            {error && (
                                <Alert className="border-red-200 bg-red-50">
                                    <AlertTriangle className="h-4 w-4 text-red-600" />
                                    <div className="text-red-700">{error}</div>
                                </Alert>
                            )}

                            <Button
                                type="submit"
                                className="w-full"
                                disabled={isLoading}
                            >
                                {isLoading
                                    ? "กำลังเพิ่มพนักงาน..."
                                    : "เพิ่มพนักงาน"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            <SuccessModal
                isOpen={showSuccessModal}
                onClose={handleModalClose}
                title="เพิ่มพนักงานสำเร็จ!"
                description="ข้อมูลพนักงานใหม่ถูกเพิ่มเข้าระบบเรียบร้อยแล้ว"
                buttonText="ตกลง"
            />
        </>
    );
}
