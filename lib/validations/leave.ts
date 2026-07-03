import * as z from "zod";
import {
  EMERGENCY_BACKDATE_LIMIT_DAYS,
  isPastDate,
  isWithinEmergencyBackdateWindow,
} from "@/lib/services/leave/utils";
import { getLeaveYearFromDateValue } from "@/lib/services/leave/quota-year";

const LEAVE_VALIDATION_MESSAGES = {
  crossYearRequest: "ไม่สามารถลาข้ามปีได้ กรุณาแยกคำขอเป็นคนละปี",
  rejectReasonRequired: "กรุณาระบุเหตุผลในการไม่อนุมัติ",
  emergencyReasonRequired: "กรุณาระบุเหตุผลฉุกเฉินสำหรับการลาย้อนหลัง",
  emergencyBackdateTooOld: `สามารถลาย้อนหลังกรณีฉุกเฉินได้ไม่เกิน ${EMERGENCY_BACKDATE_LIMIT_DAYS} วัน`,
} as const;

const optionalLongTextSchema = (message: string) =>
  z.string()
    .trim()
    .max(1000, "ข้อความต้องไม่เกิน 1000 ตัวอักษร")
    .optional()
    .refine((value) => !value || value.length >= 5, { message });

export const leaveRequestSchema = z.object({
  leaveType: z.enum(["SICK", "PERSONAL", "VACATION"], {
    message: "กรุณาเลือกประเภทการลา",
  }),
  startDate: z.string().min(1, "กรุณาระบุวันที่เริ่มต้น").refine((val) => !isNaN(Date.parse(val)), "รูปแบบวันที่ไม่ถูกต้อง"),
  endDate: z.string().min(1, "กรุณาระบุวันที่สิ้นสุด").refine((val) => !isNaN(Date.parse(val)), "รูปแบบวันที่ไม่ถูกต้อง"),
  period: z.enum(["FULL_DAY", "MORNING", "AFTERNOON"], {
    message: "กรุณาเลือกช่วงเวลา",
  }),
  reason: z.string().min(5, "กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร"),
  emergencyReason: optionalLongTextSchema(LEAVE_VALIDATION_MESSAGES.emergencyReasonRequired),
  specialReason: optionalLongTextSchema("กรุณาระบุเหตุผลพิเศษอย่างน้อย 5 ตัวอักษร"),
}).refine((data) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    return end >= start;
}, {
    message: "วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น",
    path: ["endDate"]
}).refine((data) => {
    return getLeaveYearFromDateValue(data.startDate) === getLeaveYearFromDateValue(data.endDate);
}, {
    message: LEAVE_VALIDATION_MESSAGES.crossYearRequest,
    path: ["endDate"]
}).superRefine((data, ctx) => {
    const start = new Date(data.startDate);
    if (Number.isNaN(start.getTime()) || !isPastDate(start)) {
      return;
    }

    if (!isWithinEmergencyBackdateWindow(start)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: LEAVE_VALIDATION_MESSAGES.emergencyBackdateTooOld,
        path: ["startDate"],
      });
    }

    if (!data.emergencyReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: LEAVE_VALIDATION_MESSAGES.emergencyReasonRequired,
        path: ["emergencyReason"],
      });
    }
});

const leaveIdSchema = z
  .string({ message: "ไม่พบรหัสคำขอลา" })
  .trim()
  .min(1, "ไม่พบรหัสคำขอลา");

const emptyToNull = (value: unknown): unknown => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

export const leaveCancelSchema = z.object({
  leaveId: leaveIdSchema,
});

export const leaveNotTakenRequestSchema = z.object({
  leaveId: leaveIdSchema,
  note: z.string().trim().min(5, "กรุณาระบุโน๊ตอย่างน้อย 5 ตัวอักษร").max(1000, "โน๊ตต้องไม่เกิน 1000 ตัวอักษร"),
});

export const leaveNotTakenConfirmSchema = z.object({
  leaveId: leaveIdSchema,
});

export const leaveActionSchema = z.object({
  leaveId: leaveIdSchema,
  action: z.enum(["APPROVE", "REJECT"], {
    message: "การดำเนินการไม่ถูกต้อง",
  }),
  reason: z.preprocess(
    emptyToNull,
    z.string().trim().max(1000, "เหตุผลต้องไม่เกิน 1000 ตัวอักษร").nullish(),
  ),
}).superRefine((data, ctx) => {
  if (data.action === "REJECT" && !data.reason) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reason"],
      message: LEAVE_VALIDATION_MESSAGES.rejectReasonRequired,
    });
  }
});

export type LeaveRequestValues = z.infer<typeof leaveRequestSchema>;
export type LeaveCancelValues = z.infer<typeof leaveCancelSchema>;
export type LeaveNotTakenRequestValues = z.infer<typeof leaveNotTakenRequestSchema>;
export type LeaveNotTakenConfirmValues = z.infer<typeof leaveNotTakenConfirmSchema>;
export type LeaveActionValues = z.infer<typeof leaveActionSchema>;
