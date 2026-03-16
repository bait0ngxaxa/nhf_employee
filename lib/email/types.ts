export interface EmailData {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

export interface LeaveActionPayload {
    leaveId: string;
    employeeName: string;
    managerId: number;
    leaveType: "SICK" | "PERSONAL" | "VACATION";
    startDate: string;
    endDate: string;
    durationDays: number;
    reason: string;
}

export interface LeaveResultPayload {
    leaveId: string;
    employeeId: number;
    employeeEmail: string;
    status: string;
    reason: string | null;
}
