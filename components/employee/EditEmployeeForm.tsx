"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Alert } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle } from "lucide-react";
import {
    type EditEmployeeFormProps,
    type EmployeeFormData,
    type Department,
    type EmployeeStatusValue,
} from "@/types/employees";

export function EditEmployeeForm({
    employee,
    isOpen,
    onClose,
    onSuccess,
}: EditEmployeeFormProps) {
    const [formData, setFormData] = useState<EmployeeFormData>({
        firstName: "",
        lastName: "",
        nickname: "",
        email: "",
        phone: "",
        position: "",
        affiliation: "",
        departmentId: "",
        status: "ACTIVE",
        hireDate: "",
    });

    const [departments, setDepartments] = useState<Department[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    // Load employee data when modal opens
    useEffect(() => {
        if (employee && isOpen) {
            setFormData({
                firstName: employee.firstName,
                lastName: employee.lastName,
                nickname: employee.nickname || "",
                email: employee.email.includes("@temp.local")
                    ? ""
                    : employee.email,
                phone: employee.phone || "",
                position: employee.position,
                affiliation: employee.affiliation || "",
                departmentId: employee.dept.id.toString(),
                status: employee.status,
            });
            setError("");
        }
    }, [employee, isOpen]);

    // Fetch departments
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

        if (isOpen) {
            fetchDepartments();
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!employee) return;

        setIsLoading(true);
        setError("");

        try {
            const response = await fetch(`/api/employees/${employee.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (response.ok) {
                // Let parent handle closing form and showing success modal
                onSuccess?.();
            } else {
                setError(data.error || "เกิดข้อผิดพลาดในการแก้ไขข้อมูล");
            }
        } catch {
            setError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            firstName: "",
            lastName: "",
            nickname: "",
            email: "",
            phone: "",
            position: "",
            affiliation: "",
            departmentId: "",
            status: "ACTIVE",
        });
        setError("");
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    if (!employee) return null;

    return (
        <>
            <Dialog open={isOpen} onOpenChange={handleClose}>
                <DialogContent className="max-w-md mx-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center space-x-2">
                            <span>แก้ไขข้อมูลพนักงาน</span>
                        </DialogTitle>
                        <DialogDescription>
                            แก้ไขข้อมูลของ {employee.firstName}{" "}
                            {employee.lastName}
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="firstName">ชื่อ *</Label>
                                <Input
                                    id="firstName"
                                    type="text"
                                    required
                                    value={formData.firstName}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            firstName: e.target.value,
                                        })
                                    }
                                    placeholder="ชื่อ"
                                />
                            </div>
                            <div>
                                <Label htmlFor="lastName">นามสกุล *</Label>
                                <Input
                                    id="lastName"
                                    type="text"
                                    required
                                    value={formData.lastName}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            lastName: e.target.value,
                                        })
                                    }
                                    placeholder="นามสกุล"
                                />
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="nickname">ชื่อเล่น</Label>
                            <Input
                                id="nickname"
                                type="text"
                                value={formData.nickname}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        nickname: e.target.value,
                                    })
                                }
                                placeholder="ชื่อเล่น"
                            />
                        </div>

                        <div>
                            <Label htmlFor="email">อีเมล</Label>
                            <Input
                                id="email"
                                type="email"
                                value={formData.email}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        email: e.target.value,
                                    })
                                }
                                placeholder="อีเมล (เว้นว่างได้)"
                            />
                        </div>

                        <div>
                            <Label htmlFor="phone">เบอร์โทรศัพท์</Label>
                            <Input
                                id="phone"
                                type="tel"
                                value={formData.phone}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        phone: e.target.value,
                                    })
                                }
                                placeholder="เบอร์โทรศัพท์"
                            />
                        </div>

                        <div>
                            <Label htmlFor="position">ตำแหน่ง *</Label>
                            <Input
                                id="position"
                                type="text"
                                required
                                value={formData.position}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        position: e.target.value,
                                    })
                                }
                                placeholder="ตำแหน่งงาน"
                            />
                        </div>

                        <div>
                            <Label htmlFor="affiliation">สังกัด</Label>
                            <Input
                                id="affiliation"
                                type="text"
                                value={formData.affiliation}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        affiliation: e.target.value,
                                    })
                                }
                                placeholder="หน่วยงาน/องค์กรที่สังกัด"
                            />
                        </div>

                        <div>
                            <Label htmlFor="department">แผนก *</Label>
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

                        <div>
                            <Label htmlFor="status">สถานะ *</Label>
                            <Select
                                value={formData.status}
                                onValueChange={(value) =>
                                    setFormData({
                                        ...formData,
                                        status: value as EmployeeStatusValue,
                                    })
                                }
                                required
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="เลือกสถานะ" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ACTIVE">
                                        ทำงานอยู่
                                    </SelectItem>
                                    <SelectItem value="INACTIVE">
                                        ไม่ทำงาน
                                    </SelectItem>
                                    <SelectItem value="SUSPENDED">
                                        ถูกระงับ
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {error && (
                            <Alert className="border-red-200 bg-red-50">
                                <AlertTriangle className="h-4 w-4 text-red-600" />
                                <div className="text-red-700">{error}</div>
                            </Alert>
                        )}

                        <div className="flex items-center justify-end space-x-3 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleClose}
                                disabled={isLoading}
                            >
                                ยกเลิก
                            </Button>
                            <Button
                                type="submit"
                                disabled={isLoading}
                                className="flex items-center space-x-2"
                            >
                                {isLoading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                        <span>กำลังบันทึก...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="h-4 w-4" />
                                        <span>บันทึกการแก้ไข</span>
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}
