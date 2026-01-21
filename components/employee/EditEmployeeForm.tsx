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

import { updateEmployeeSchema } from "@/lib/validations/employee";

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
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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
            setFieldErrors({});
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

        setError("");
        setFieldErrors({});

        // Client-side validation
        const result = updateEmployeeSchema.safeParse(formData);

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
                // Since this is a Dialog, focus/scroll might happen within the dialog content.
                // scrollIntoView works fine if the container is scrollable or body is scrollable.
                // Shadcn DialogContent usually fits screen or is scrollable.
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
        setFieldErrors({});
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    if (!employee) return null;

    return (
        <>
            <Dialog open={isOpen} onOpenChange={handleClose}>
                <DialogContent className="max-w-md mx-auto h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center space-x-2">
                            <span>แก้ไขข้อมูลพนักงาน</span>
                        </DialogTitle>
                        <DialogDescription>
                            แก้ไขข้อมูลของ {employee.firstName}{" "}
                            {employee.lastName}
                        </DialogDescription>
                    </DialogHeader>

                    <form
                        onSubmit={handleSubmit}
                        className="space-y-4"
                        noValidate
                    >
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label
                                    htmlFor="firstName"
                                    className={
                                        fieldErrors.firstName
                                            ? "text-red-500"
                                            : ""
                                    }
                                >
                                    ชื่อ *
                                </Label>
                                <Input
                                    id="firstName"
                                    type="text"
                                    value={formData.firstName}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            firstName: e.target.value,
                                        })
                                    }
                                    placeholder="ชื่อ"
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
                            <div>
                                <Label
                                    htmlFor="lastName"
                                    className={
                                        fieldErrors.lastName
                                            ? "text-red-500"
                                            : ""
                                    }
                                >
                                    นามสกุล *
                                </Label>
                                <Input
                                    id="lastName"
                                    type="text"
                                    value={formData.lastName}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            lastName: e.target.value,
                                        })
                                    }
                                    placeholder="นามสกุล"
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

                        <div>
                            <Label
                                htmlFor="nickname"
                                className={
                                    fieldErrors.nickname ? "text-red-500" : ""
                                }
                            >
                                ชื่อเล่น
                            </Label>
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

                        <div>
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
                                value={formData.email}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        email: e.target.value,
                                    })
                                }
                                placeholder="อีเมล (เว้นว่างได้)"
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

                        <div>
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
                                value={formData.phone}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        phone: e.target.value,
                                    })
                                }
                                placeholder="เบอร์โทรศัพท์"
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

                        <div>
                            <Label
                                htmlFor="position"
                                className={
                                    fieldErrors.position ? "text-red-500" : ""
                                }
                            >
                                ตำแหน่ง *
                            </Label>
                            <Input
                                id="position"
                                type="text"
                                value={formData.position}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        position: e.target.value,
                                    })
                                }
                                placeholder="ตำแหน่งงาน"
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

                        <div>
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
                                value={formData.affiliation}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        affiliation: e.target.value,
                                    })
                                }
                                placeholder="หน่วยงาน/องค์กรที่สังกัด"
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

                        <div>
                            <Label
                                htmlFor="departmentId"
                                className={
                                    fieldErrors.departmentId
                                        ? "text-red-500"
                                        : ""
                                }
                            >
                                แผนก *
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

                        <div>
                            <Label
                                htmlFor="status"
                                className={
                                    fieldErrors.status ? "text-red-500" : ""
                                }
                            >
                                สถานะ *
                            </Label>
                            <Select
                                value={formData.status}
                                onValueChange={(value) =>
                                    setFormData({
                                        ...formData,
                                        status: value as EmployeeStatusValue,
                                    })
                                }
                            >
                                <SelectTrigger
                                    id="status"
                                    className={
                                        fieldErrors.status
                                            ? "border-red-500 focus:ring-red-500"
                                            : ""
                                    }
                                >
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
                            {fieldErrors.status && (
                                <p className="text-xs text-red-500">
                                    {fieldErrors.status}
                                </p>
                            )}
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
