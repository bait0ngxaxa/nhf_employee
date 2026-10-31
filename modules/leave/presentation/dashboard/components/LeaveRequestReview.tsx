"use client";

import { useEffect, useRef, type ReactElement } from "react";
import type { useLeaveRequestFormModel } from "../hooks/useLeaveRequestFormModel";
import { LeaveDurationCalculation } from "./LeaveRequestFormFields";
import { LeaveRequestSummary } from "../../LeaveRequestSummary";
import { formatLeaveDateRange, getLeavePeriodLabel } from "../../liff/leave-format";

type LeaveRequestFormModel = ReturnType<typeof useLeaveRequestFormModel>;

function ReviewItem({
    label,
    children,
}: {
    readonly label: string;
    readonly children: ReactElement | string;
}): ReactElement {
    return (
        <div className="min-w-0 space-y-1">
            <dt className="text-xs leading-5 text-content-secondary">{label}</dt>
            <dd className="whitespace-pre-line break-words text-sm leading-6 text-content-heading [overflow-wrap:anywhere]">
                {children}
            </dd>
        </div>
    );
}

export function LeaveRequestReview({ model }: { readonly model: LeaveRequestFormModel }): ReactElement {
    const containerRef = useRef<HTMLDivElement>(null);
    const values = model.form.getValues();
    const emergencyReason = model.needsEmergencyReason ? values.emergencyReason?.trim() : undefined;
    const specialReason = model.needsSpecialReason ? values.specialReason?.trim() : undefined;

    useEffect(() => {
        containerRef.current?.focus();
    }, []);

    return (
        <div
            ref={containerRef}
            role="group"
            aria-label="ตรวจสอบคำขอลา"
            tabIndex={-1}
            className="flex flex-col gap-5 outline-none"
        >
            <LeaveRequestSummary
                leaveType={model.selectedLeaveType}
                requestedDays={model.requestedDays}
                remainingQuota={model.remainingQuota}
                projectedRemainingQuota={model.projectedRemainingQuota}
                overQuotaDays={model.overQuotaDays}
                isDateRangeValid={model.isDateRangeValid}
            />
            <LeaveDurationCalculation model={model} />
            <dl className="grid gap-4 rounded-xl border border-border-subtle p-4 sm:grid-cols-2">
                <ReviewItem label={model.isMultiDay ? "ช่วงวันที่ลา" : "วันที่ลา"}>
                    {formatLeaveDateRange(values.startDate, values.endDate)}
                </ReviewItem>
                <ReviewItem label="ช่วงเวลา">
                    {getLeavePeriodLabel(values.period)}
                </ReviewItem>
                <div className="sm:col-span-2">
                    <ReviewItem label="เหตุผลการลา">{values.reason.trim()}</ReviewItem>
                </div>
                {emergencyReason ? (
                    <div className="sm:col-span-2">
                        <ReviewItem label="เหตุผลในการลาย้อนหลัง">{emergencyReason}</ReviewItem>
                    </div>
                ) : null}
                {specialReason ? (
                    <div className="sm:col-span-2">
                        <ReviewItem label="เหตุผลพิเศษ">{specialReason}</ReviewItem>
                    </div>
                ) : null}
                <div className="sm:col-span-2">
                    <ReviewItem label="รูปภาพประกอบ">
                        {model.attachments.length === 0 ? (
                            "ไม่มี"
                        ) : (
                            <ul className="space-y-0.5">
                                {model.attachments.map((file, index) => (
                                    <li key={`${file.name}-${index}`}>{file.name}</li>
                                ))}
                            </ul>
                        )}
                    </ReviewItem>
                </div>
            </dl>
        </div>
    );
}
