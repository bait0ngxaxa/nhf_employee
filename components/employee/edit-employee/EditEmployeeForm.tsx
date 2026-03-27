"use client";

import { Button } from "@/components/ui/button";
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
import { type EditEmployeeFormProps } from "@/types/employees";
import { EmployeeFormFields } from "../shared";
import { useEditEmployee } from "./useEditEmployee";

export function EditEmployeeForm({
    employee,
    isOpen,
    onClose,
    onSuccess,
}: EditEmployeeFormProps) {
    const {
        formData,
        departments,
        isLoading,
        error,
        fieldErrors,
        handleFieldChange,
        handleStatusChange,
        handleSubmit,
        handleClose,
    } = useEditEmployee({ employee, isOpen, onClose, onSuccess });

    if (!employee) return null;

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-md mx-auto h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center space-x-2">
                        <span>แก้ไขข้อมูลพนักงาน</span>
                    </DialogTitle>
                    <DialogDescription>
                        แก้ไขข้อมูลของ {employee.firstName} {employee.lastName}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                    <EmployeeFormFields
                        formData={formData}
                        fieldErrors={fieldErrors}
                        departments={departments}
                        onFieldChange={handleFieldChange}
                    />

                    {/* Status Select (Edit only) */}
                    <div className="grid gap-3">
                        <Label
                            htmlFor="status"
                            className={fieldErrors.status ? "text-red-500" : ""}
                        >
                            สถานะ *
                        </Label>
                        <Select
                            value={formData.status}
                            onValueChange={handleStatusChange}
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

                    <div className="flex items-center justify-end gap-3 pt-5 border-t mt-4">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={handleClose}
                            disabled={isLoading}
                            className="h-10 px-5 font-medium hover:bg-slate-100 text-slate-600"
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="h-10 px-7 font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all flex items-center space-x-2"
                        >
                            {isLoading ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                                    <span>กำลังบันทึก...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="h-4.5 w-4.5" />
                                    <span>บันทึกการแก้ไข</span>
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
