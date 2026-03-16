import * as z from "zod";

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
}).refine((data) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    return end >= start;
}, {
    message: "วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น",
    path: ["endDate"]
});

export type LeaveRequestValues = z.infer<typeof leaveRequestSchema>;
