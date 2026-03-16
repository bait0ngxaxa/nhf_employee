import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { apiPost } from "@/lib/api-client";
import { Loader2 } from "lucide-react";

import {
    leaveRequestSchema,
    type LeaveRequestValues,
} from "@/lib/validations/leave";

interface Props {
    onSuccess: () => void;
    onCancel: () => void;
}

export function LeaveRequestForm({ onSuccess, onCancel }: Props) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [isMultiDay, setIsMultiDay] = useState(false);

    const today = format(new Date(), "yyyy-MM-dd");

    const form = useForm<LeaveRequestValues>({
        resolver: zodResolver(leaveRequestSchema),
        defaultValues: {
            leaveType: "SICK",
            startDate: today,
            endDate: today,
            period: "FULL_DAY",
            reason: "",
        },
    });

    const startDateValue = form.watch("startDate");

    // Sync endDate = startDate when in single-day mode
    useEffect(() => {
        if (!isMultiDay) {
            form.setValue("endDate", startDateValue);
        }
    }, [isMultiDay, startDateValue, form]);

    // When switching to multi-day, force period to FULL_DAY
    useEffect(() => {
        if (isMultiDay) {
            form.setValue("period", "FULL_DAY");
        }
    }, [isMultiDay, form]);



    async function onSubmit(data: LeaveRequestValues): Promise<void> {
        setIsSubmitting(true);
        setErrorMsg(null);

        try {
            const res = await apiPost("/api/leave/request", data);

            if (res.success) {
                onSuccess();
            } else {
                setErrorMsg(res.error || "เกิดข้อผิดพลาดในการส่งใบลา");
            }
        } catch (_error) {
            setErrorMsg("เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์");
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="bg-white/80 backdrop-blur-xl p-6 md:p-8 rounded-3xl border border-white/60 shadow-xl relative overflow-hidden">
            <div className="absolute -left-10 -bottom-10 w-40 h-40 rounded-full opacity-20 bg-indigo-400 blur-3xl pointer-events-none" />
            
            <div className="relative z-10 mb-8 border-b border-gray-100 pb-4">
                <h3 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                    แบบฟอร์มยื่นใบลา
                </h3>
                <p className="text-sm text-gray-500 mt-1 font-medium">
                    กรุณากรอกข้อมูลให้ครบถ้วนเพื่อให้หัวหน้างานพิจารณา
                </p>
            </div>

            {errorMsg && (
                <div className="relative z-10 mb-6 p-4 bg-red-50/80 backdrop-blur-sm border border-red-100 text-red-600 rounded-xl text-sm font-medium shadow-sm">
                    {errorMsg}
                </div>
            )}

            <Form {...form}>
                <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-6 relative z-10"
                >
                    <FormField
                        control={form.control}
                        name="leaveType"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>ประเภทการลา</FormLabel>
                                <Select
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                >
                                    <FormControl>
                                        <SelectTrigger>
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

                    {/* Toggle วันเดียว / หลายวัน */}
                    <div className="space-y-1.5">
                        <FormLabel className="text-sm font-medium">จำนวนวันลา</FormLabel>
                        <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-lg">
                            <button
                                type="button"
                                onClick={() => setIsMultiDay(false)}
                                className={`
                                    py-2 text-sm font-medium rounded-md transition-all duration-200
                                    ${!isMultiDay
                                        ? "bg-white text-indigo-700 shadow-sm"
                                        : "text-gray-500 hover:text-gray-700"
                                    }
                                `}
                            >
                                วันเดียว
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsMultiDay(true)}
                                className={`
                                    py-2 text-sm font-medium rounded-md transition-all duration-200
                                    ${isMultiDay
                                        ? "bg-white text-indigo-700 shadow-sm"
                                        : "text-gray-500 hover:text-gray-700"
                                    }
                                `}
                            >
                                หลายวัน
                            </button>
                        </div>
                    </div>

                    {/* Date Fields */}
                    <div className={`grid gap-4 ${isMultiDay ? "grid-cols-2" : "grid-cols-1"}`}>
                        <FormField
                            control={form.control}
                            name="startDate"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{isMultiDay ? "วันที่เริ่มต้น" : "วันที่ลา"}</FormLabel>
                                    <FormControl>
                                        <Input type="date" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {isMultiDay && (
                            <FormField
                                control={form.control}
                                name="endDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>วันที่สิ้นสุด</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="date"
                                                {...field}
                                                min={startDateValue}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}
                    </div>

                    {/* Period — only show for single-day */}
                    {!isMultiDay && (
                        <FormField
                            control={form.control}
                            name="period"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>ช่วงเวลา</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        value={field.value}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
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
                    )}

                    <FormField
                        control={form.control}
                        name="reason"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>เหตุผลการลา</FormLabel>
                                <FormControl>
                                    <Textarea
                                        placeholder="ระบุเหตุผลการลาของคุณ..."
                                        className="resize-none"
                                        rows={3}
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="flex justify-end space-x-4 pt-4 border-t">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onCancel}
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            type="submit"
                            disabled={isSubmitting}
                            className="bg-indigo-600 hover:bg-indigo-700"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    กำลังบันทึก...
                                </>
                            ) : (
                                "ส่งใบลา"
                            )}
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    );
}
