"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
import { APP_ROUTES } from "@/lib/ssot/routes";
import { DashboardNavigationLink } from "@/components/dashboard/layout/DashboardNavigationLink";
import type { AddEmployeeFormProps } from "../types";
import { EmployeeFormFields } from "../shared";
import { useAddEmployee } from "./useAddEmployee";

export function AddEmployeeForm({
    onSuccess,
    canReadDepartments,
    canReadEmployees,
}: AddEmployeeFormProps): React.ReactElement {
    const {
        formData,
        departments,
        canReadDepartments: projectedCanReadDepartments,
        isLoading,
        hasUnresolvedSubmission,
        recoveryAcknowledged,
        error,
        fieldErrors,
        handleFieldChange,
        acknowledgeUnresolvedSubmission,
        handleSubmit,
    } = useAddEmployee({ onSuccess, canReadDepartments });
    const formLocked = hasUnresolvedSubmission || recoveryAcknowledged;

    return (
        <Card className="mx-auto w-full max-w-3xl rounded-xl border-border-subtle bg-surface-raised shadow-none">
            <CardContent className="pt-6">
                <form data-navigation-dirty={Object.values(formData).some((value) => value !== "")} data-navigation-submitting={isLoading} data-navigation-unresolved={hasUnresolvedSubmission} data-navigation-recovery="ยังยืนยันผลการเพิ่มพนักงานไม่ได้ กรุณาตรวจสอบรายการด้วยสิทธิ์ที่ได้รับก่อนตัดสินใจออกจากแบบฟอร์ม" onSubmit={handleSubmit} noValidate aria-busy={isLoading}>
                    <div className="flex flex-col gap-6">
                        <fieldset disabled={formLocked} className="contents">
                            <EmployeeFormFields
                                formData={formData}
                                fieldErrors={fieldErrors}
                                departments={departments}
                                canReadDepartments={projectedCanReadDepartments}
                                onFieldChange={handleFieldChange}
                            />
                        </fieldset>

                        {error && (
                            <Alert className="border-status-error-border bg-status-error-surface" aria-live="assertive">
                                <AlertTriangle className="h-4 w-4 text-status-error-muted" />
                                <AlertTitle className="text-status-error-strong">
                                    {hasUnresolvedSubmission || recoveryAcknowledged
                                        ? "ผลการเพิ่มพนักงานยังไม่ชัดเจน"
                                        : "เพิ่มพนักงานไม่สำเร็จ"}
                                </AlertTitle>
                                <AlertDescription className="text-status-error-foreground [overflow-wrap:anywhere]">
                                    {error}
                                    {hasUnresolvedSubmission ? (
                                        <div className="mt-2 space-y-2">
                                            <p>
                                                ระบบยังยืนยันไม่ได้ว่ารายการถูกสร้างแล้วหรือไม่ กรุณาอย่าส่งคำขอซ้ำ หากตรวจสอบไม่พบหรือไม่มีสิทธิ์ดูรายชื่อ ให้ติดต่อผู้ดูแลระบบ
                                            </p>
                                            {canReadEmployees ? (
                                                <a
                                                    href={APP_ROUTES.dashboardEmployees}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex min-h-11 items-center font-semibold text-brand-foreground underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                >
                                                    ตรวจสอบรายชื่อพนักงานในแท็บใหม่
                                                </a>
                                            ) : null}
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={acknowledgeUnresolvedSubmission}
                                            >
                                                รับทราบผลที่ยังไม่ยืนยัน
                                            </Button>
                                        </div>
                                    ) : null}
                                    {recoveryAcknowledged ? (
                                        <div className="mt-2 space-y-2">
                                            <p>
                                                รับทราบแล้ว ข้อมูลแบบฟอร์มยังคงอยู่และจะไม่ถูกส่งซ้ำ การออกจากหน้านี้จะละทิ้งข้อมูลที่กรอก
                                            </p>
                                            <Button asChild variant="outline">
                                                <DashboardNavigationLink href={canReadEmployees
                                                    ? APP_ROUTES.dashboardEmployees
                                                    : APP_ROUTES.dashboard}>
                                                    ออกจากแบบฟอร์มโดยไม่ส่งซ้ำ
                                                </DashboardNavigationLink>
                                            </Button>
                                        </div>
                                    ) : null}
                                </AlertDescription>
                            </Alert>
                        )}

                        <Button
                            type="submit"
                            className="h-11 w-full bg-action-primary-solid text-base font-bold text-content-on-brand transition-colors hover:bg-action-primary-solid-hover"
                            disabled={isLoading || formLocked || !projectedCanReadDepartments}
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    กำลังเพิ่มพนักงาน...
                                </>
                            ) : (
                                "เพิ่มพนักงาน"
                            )}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
