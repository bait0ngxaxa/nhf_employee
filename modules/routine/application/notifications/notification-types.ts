export interface RoutineReminderEmailData {
    to: string;
    recipientName: string;
    taskTitle: string;
    unitName: string;
    categoryName: string;
    dueDate: string;
    daysBefore: number;
    actionUrl: string;
    occurrenceId: number;
    ruleId: number;
    userId: number;
    reminderVersion: number;
}

export interface RoutineContractExpiryEmailData {
    to: string;
    recipientName: string;
    taskTitle: string;
    unitName: string;
    categoryName: string;
    contractEndDate: string;
    actionUrl: string;
    taskId: number;
    userId: number;
}
