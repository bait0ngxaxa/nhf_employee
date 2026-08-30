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
import { getEmployeeDisplayName } from "@/lib/helpers/employee-helpers";

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
                        แก้ไขข้อมูลของ {getEmployeeDisplayName(employee)}
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
                            className={fieldErrors.status ? "text-status-error-icon" : ""}
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
                                        ? "border-status-error-focus focus:ring-status-error-focus"
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
                            <p className="text-xs text-status-error-icon">
                                {fieldErrors.status}
                            </p>
                        )}
                    </div>

                    {error && (
                        <Alert className="border-status-error-border bg-status-error-surface">
                            <AlertTriangle className="h-4 w-4 text-status-error-muted" />
                            <div className="text-status-error-foreground">{error}</div>
                        </Alert>
                    )}

                    <div className="flex items-center justify-end gap-3 pt-5 border-t mt-4">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={handleClose}
                            disabled={isLoading}
                            className="h-11 px-5 font-medium hover:bg-surface-muted text-content-secondary"
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            type="submit"
                            disabled={isLoading}
                            className="h-11 px-7 font-bold bg-action-primary-solid hover:bg-action-primary-solid-hover text-content-on-brand shadow-sm transition-all flex items-center space-x-2"
                        >
                            {isLoading ? (
                                <>
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-content-on-brand" />
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
