import { isAdminRole } from "./permissions";

const URGENT_PRIORITY = "URGENT";
const URGENT_PRIORITY_FORBIDDEN_MESSAGE =
    "เฉพาะผู้ดูแลระบบเท่านั้นที่กำหนดระดับเร่งด่วนได้";

export class TicketPriorityForbiddenError extends Error {
    constructor() {
        super(URGENT_PRIORITY_FORBIDDEN_MESSAGE);
        this.name = "TicketPriorityForbiddenError";
    }
}

export function canCreateTicketWithPriority(
    priority: string,
    role: string,
): boolean {
    return priority !== URGENT_PRIORITY || isAdminRole(role);
}

export function assertCanCreateTicketWithPriority(
    priority: string,
    role: string,
): void {
    if (!canCreateTicketWithPriority(priority, role)) {
        throw new TicketPriorityForbiddenError();
    }
}
