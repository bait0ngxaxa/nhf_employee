"use client";

import {
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { useLeaveRequestFormModel } from "@/hooks/leave/useLeaveRequestFormModel";
import { cn } from "@/lib/ui/utils";

type LeaveRequestFormModel = ReturnType<typeof useLeaveRequestFormModel>;

export function LeaveDialogFields({ model }: { model: LeaveRequestFormModel }) {
    return (
        <div className="flex flex-col gap-5">
            <LeaveTypeField model={model} />
            <LeaveDateModeField model={model} />
            <LeaveDateFields model={model} />
            {!model.isMultiDay ? <LeavePeriodField model={model} /> : null}
            <LeaveReasonField model={model} />
            {model.needsEmergencyReason ? <EmergencyReasonField model={model} /> : null}
            {model.needsSpecialReason ? <SpecialReasonField model={model} /> : null}
        </div>
    );
}

function LeaveTypeField({ model }: { model: LeaveRequestFormModel }) {
    return (
        <FormField
            control={model.form.control}
            name="leaveType"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>ประเภทการลา</FormLabel>
                    <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={model.isSubmitting}
                    >
                        <FormControl>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="เลือกประเภทการลา" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="SICK">ลาป่วย</SelectItem>
                            <SelectItem value="PERSONAL">ลากิจ</SelectItem>
                            <SelectItem value="VACATION">ลาพักร้อน</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
            )}
        />
    );
}

function LeaveDateModeField({ model }: { model: LeaveRequestFormModel }) {
    return (
        <fieldset className="flex flex-col gap-2" disabled={model.isSubmitting}>
            <legend className="text-sm font-medium text-foreground">จำนวนวันลา</legend>
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                <button
                    type="button"
                    aria-pressed={!model.isMultiDay}
                    onClick={model.switchToSingleDay}
                    className={getDateModeButtonClassName(!model.isMultiDay)}
                >
                    วันเดียว
                </button>
                <button
                    type="button"
                    aria-pressed={model.isMultiDay}
                    onClick={model.switchToMultiDay}
                    className={getDateModeButtonClassName(model.isMultiDay)}
                >
                    หลายวัน
                </button>
            </div>
        </fieldset>
    );
}

function getDateModeButtonClassName(isSelected: boolean): string {
    return cn(
        "h-10 rounded-md px-3 text-sm font-medium transition-[color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        isSelected
            ? "bg-background text-primary shadow-xs"
            : "text-muted-foreground hover:text-foreground",
    );
}

function LeaveDateFields({ model }: { model: LeaveRequestFormModel }) {
    return (
        <div className="grid gap-4 sm:grid-cols-2">
            <FormField
                control={model.form.control}
                name="startDate"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>{model.isMultiDay ? "วันที่เริ่มต้น" : "วันที่ลา"}</FormLabel>
                        <FormControl>
                            <Input
                                type="date"
                                disabled={model.isSubmitting}
                                {...field}
                                onChange={(event) =>
                                    model.handleStartDateChange(event.target.value, field.onChange)
                                }
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            {model.isMultiDay ? <LeaveEndDateField model={model} /> : null}
        </div>
    );
}

function LeaveEndDateField({ model }: { model: LeaveRequestFormModel }) {
    return (
        <FormField
            control={model.form.control}
            name="endDate"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>วันที่สิ้นสุด</FormLabel>
                    <FormControl>
                        <Input
                            type="date"
                            min={model.startDateValue}
                            disabled={model.isSubmitting}
                            {...field}
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    );
}

function LeavePeriodField({ model }: { model: LeaveRequestFormModel }) {
    return (
        <FormField
            control={model.form.control}
            name="period"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>ช่วงเวลา</FormLabel>
                    <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={model.isSubmitting}
                    >
                        <FormControl>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="เลือกช่วงเวลา" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="FULL_DAY">เต็มวัน</SelectItem>
                            <SelectItem value="MORNING">ครึ่งวันเช้า</SelectItem>
                            <SelectItem value="AFTERNOON">ครึ่งวันบ่าย</SelectItem>
                        </SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
            )}
        />
    );
}

function LeaveReasonField({ model }: { model: LeaveRequestFormModel }) {
    return (
        <FormField
            control={model.form.control}
            name="reason"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>เหตุผลการลา</FormLabel>
                    <FormControl>
                        <Textarea
                            placeholder="ระบุเหตุผลการลาของคุณ"
                            className="min-h-24 resize-none"
                            rows={4}
                            disabled={model.isSubmitting}
                            {...field}
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    );
}

function EmergencyReasonField({ model }: { model: LeaveRequestFormModel }) {
    return (
        <FormField
            control={model.form.control}
            name="emergencyReason"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>เหตุผลฉุกเฉิน</FormLabel>
                    <FormControl>
                        <Textarea
                            placeholder="ระบุเหตุฉุกเฉินที่ทำให้ไม่สามารถยื่นลาตามเวลาปกติ"
                            className="min-h-24 resize-none"
                            rows={4}
                            maxLength={1000}
                            disabled={model.isSubmitting}
                            {...field}
                            value={field.value ?? ""}
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    );
}

function SpecialReasonField({ model }: { model: LeaveRequestFormModel }) {
    return (
        <FormField
            control={model.form.control}
            name="specialReason"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>เหตุผลพิเศษ</FormLabel>
                    <FormControl>
                        <Textarea
                            placeholder="ระบุเหตุผลที่ควรอนุมัติให้เกินโควต้า"
                            className="min-h-24 resize-none"
                            rows={4}
                            maxLength={1000}
                            disabled={model.isSubmitting}
                            {...field}
                            value={field.value ?? ""}
                        />
                    </FormControl>
                    <FormDescription>
                        คำขอนี้เกินสิทธิ์ {model.overQuotaDays} วัน จากคงเหลือ{" "}
                        {model.remainingQuota} วัน
                    </FormDescription>
                    <FormMessage />
                </FormItem>
            )}
        />
    );
}
