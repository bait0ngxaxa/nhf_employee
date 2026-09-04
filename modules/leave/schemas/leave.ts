import * as z from "zod";
import {
  EMERGENCY_BACKDATE_LIMIT_DAYS,
  isPastDate,
  isWithinEmergencyBackdateWindow,
} from "@/modules/leave/domain/utils";
import { compareBusinessDates } from "@/modules/leave/domain/business-date";
import { getLeaveYearFromDateValue } from "@/modules/leave/domain/quota-year";

const LEAVE_VALIDATION_MESSAGES = {
  crossYearRequest: "ไม่สามารถลาข้ามปีได้ กรุณาแยกคำขอเป็นคนละปี",
  rejectReasonRequired: "กรุณาระบุเหตุผลในการไม่อนุมัติ",
  emergencyReasonRequired: "กรุณาระบุเหตุผลในการลาย้อนหลัง",
  emergencyBackdateTooOld: `สามารถยื่นคำขอลาย้อนหลังได้ไม่เกิน ${EMERGENCY_BACKDATE_LIMIT_DAYS} วัน`,
} as const;

const optionalLongTextSchema = (message: string) =>
  z.string()
    .trim()
    .max(1000, "ข้อความต้องไม่เกิน 1000 ตัวอักษร")
    .optional()
    .refine((value) => !value || value.length >= 5, { message });

const leaveDateSchema = z.iso.date({ error: "รูปแบบวันที่ไม่ถูกต้อง" });
const leaveReasonSchema = z
  .string()
  .trim()
  .min(5, "กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร")
  .max(1000, "เหตุผลต้องไม่เกิน 1000 ตัวอักษร");

export const leaveRequestSchema = z.object({
  leaveType: z.enum(["SICK", "PERSONAL", "VACATION"], {
    message: "กรุณาเลือกประเภทการลา",
  }),
  startDate: leaveDateSchema,
  endDate: leaveDateSchema,
  period: z.enum(["FULL_DAY", "MORNING", "AFTERNOON"], {
    message: "กรุณาเลือกช่วงเวลา",
  }),
  reason: leaveReasonSchema,
  emergencyReason: optionalLongTextSchema(LEAVE_VALIDATION_MESSAGES.emergencyReasonRequired),
  specialReason: optionalLongTextSchema("กรุณาระบุเหตุผลพิเศษอย่างน้อย 5 ตัวอักษร"),
}).refine((data) => {
    return compareBusinessDates(data.endDate, data.startDate) >= 0;
}, {
    message: "วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น",
    path: ["endDate"]
}).refine((data) => {
    return getLeaveYearFromDateValue(data.startDate) === getLeaveYearFromDateValue(data.endDate);
}, {
    message: LEAVE_VALIDATION_MESSAGES.crossYearRequest,
    path: ["endDate"]
}).superRefine((data, ctx) => {
    if (!isPastDate(data.startDate)) {
      return;
    }

    if (!isWithinEmergencyBackdateWindow(data.startDate)) {
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

export const leaveAttachmentIdParamSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/);

export const leaveRequestIdParamSchema = leaveAttachmentIdParamSchema;

const emptyToNull = (value: unknown): unknown => {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
};

export const leaveCancelSchema = z.object({
  leaveId: leaveIdSchema,
  reason: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    optionalLongTextSchema("กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร"),
  ),
});

export const leaveCancellationDecisionSchema = z.object({
  leaveId: leaveIdSchema,
  action: z.enum(["CONFIRM", "REJECT"]).default("CONFIRM"),
  reason: z.preprocess(
    emptyToNull,
    z.string().trim().max(1000, "เหตุผลต้องไม่เกิน 1000 ตัวอักษร").nullish(),
  ),
});

export const leaveNotTakenRequestSchema = z.object({
  leaveId: leaveIdSchema,
  note: z.string().trim().min(5, "กรุณาระบุโน๊ตอย่างน้อย 5 ตัวอักษร").max(1000, "โน๊ตต้องไม่เกิน 1000 ตัวอักษร"),
});

export const leaveNotTakenConfirmSchema = z.object({
  leaveId: leaveIdSchema,
  reason: z.preprocess(
    emptyToNull,
    z.string().trim().max(1000, "เหตุผลต้องไม่เกิน 1000 ตัวอักษร").nullish(),
  ),
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
export type LeaveCancellationDecisionValues = z.infer<
  typeof leaveCancellationDecisionSchema
>;
export type LeaveNotTakenRequestValues = z.infer<typeof leaveNotTakenRequestSchema>;
export type LeaveNotTakenConfirmValues = z.infer<typeof leaveNotTakenConfirmSchema>;
export type LeaveActionValues = z.infer<typeof leaveActionSchema>;
