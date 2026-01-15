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
import { SuccessModal } from "@/components/SuccessModal";
import {
    AddEmployeeFormProps,
    EmployeeFormData,
    Department,
} from "@/types/employees";

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
                    <form onSubmit={handleSubmit}>
                        <div className="flex flex-col gap-6">
                            {error && (
                                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                                    {error}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3">
                                <div className="grid gap-3">
                                    <Label htmlFor="firstName">ชื่อ</Label>
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
                                        required
                                    />
                                </div>
                                <div className="grid gap-3">
                                    <Label htmlFor="lastName">นามสกุล</Label>
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
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid gap-3">
                                <Label htmlFor="nickname">
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
                                />
                            </div>

                            <div className="grid gap-3">
                                <Label htmlFor="email">อีเมล</Label>
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
                                    required
                                />
                            </div>

                            <div className="grid gap-3">
                                <Label htmlFor="phone">เบอร์โทรศัพท์</Label>
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
                                />
                            </div>

                            <div className="grid gap-3">
                                <Label htmlFor="position">ตำแหน่ง</Label>
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
                                    required
                                />
                            </div>

                            <div className="grid gap-3">
                                <Label htmlFor="affiliation">สังกัด</Label>
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
                                />
                            </div>

                            <div className="grid gap-3">
                                <Label htmlFor="department">แผนก</Label>
                                <Select
                                    value={String(formData.departmentId)}
                                    onValueChange={(value) =>
                                        setFormData({
                                            ...formData,
                                            departmentId: value,
                                        })
                                    }
                                    required
                                >
                                    <SelectTrigger>
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
                            </div>

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
