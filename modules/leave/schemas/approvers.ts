import { z } from "zod";

export const leaveApproverAssignmentsSchema = z.object({
    assignments: z
        .array(
            z.object({
                employeeId: z.number().int().positive(),
                managerId: z.number().int().positive().nullable(),
            }),
        )
        .min(1, "At least one assignment required")
        .superRefine((assignments, context) => {
            const seenEmployeeIds = new Set<number>();
            assignments.forEach((assignment, index) => {
                if (seenEmployeeIds.has(assignment.employeeId)) {
                    context.addIssue({
                        code: "custom",
                        message: "ห้ามกำหนดผู้อนุมัติซ้ำสำหรับพนักงานคนเดียวกัน",
                        path: [index, "employeeId"],
                    });
                }
                seenEmployeeIds.add(assignment.employeeId);
            });
        }),
});

export type LeaveApproverAssignments = z.infer<
    typeof leaveApproverAssignmentsSchema
>;
