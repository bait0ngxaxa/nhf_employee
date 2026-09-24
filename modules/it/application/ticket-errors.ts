export type ITTicketErrorCode =
    | "INVALID_INPUT"
    | "WORKFORCE_DENIED"
    | "TICKET_NOT_FOUND"
    | "INVALID_TRANSITION"
    | "MUTATION_CONFLICT"
    | "IDEMPOTENCY_CONFLICT"
    | "ASSIGNEE_NOT_ELIGIBLE"
    | "CATEGORY_NOT_FOUND"
    | "CATEGORY_INACTIVE";

export class ITTicketError extends Error {
    readonly code: ITTicketErrorCode;

    constructor(code: ITTicketErrorCode, message: string) {
        super(message);
        this.name = "ITTicketError";
        this.code = code;
    }
}

export class ITTicketInputValidationError extends ITTicketError {
    constructor() {
        super("INVALID_INPUT", "ข้อมูล Ticket ไม่ถูกต้องหรือยาวเกินกำหนด");
        this.name = "ITTicketInputValidationError";
    }
}

export class ITWorkforceDeniedError extends ITTicketError {
    constructor() {
        super("WORKFORCE_DENIED", "ไม่สามารถดำเนินการได้สำหรับสถานะพนักงานปัจจุบัน");
        this.name = "ITWorkforceDeniedError";
    }
}

export class ITTicketNotFoundError extends ITTicketError {
    constructor() {
        super("TICKET_NOT_FOUND", "ไม่พบ Ticket ที่ระบุ");
        this.name = "ITTicketNotFoundError";
    }
}

export class ITTicketInvalidTransitionError extends ITTicketError {
    constructor() {
        super("INVALID_TRANSITION", "ไม่สามารถเปลี่ยนสถานะ Ticket ตามขั้นตอนที่กำหนดได้");
        this.name = "ITTicketInvalidTransitionError";
    }
}

export type ITTicketMutationConflictReason = "STALE_VERSION" | "CONCURRENT_WRITE";

export class ITTicketMutationConflictError extends ITTicketError {
    readonly reason: ITTicketMutationConflictReason;

    constructor(reason: ITTicketMutationConflictReason) {
        super("MUTATION_CONFLICT", "Ticket ถูกเปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลล่าสุด");
        this.name = "ITTicketMutationConflictError";
        this.reason = reason;
    }
}

export class ITTicketIdempotencyConflictError extends ITTicketError {
    constructor() {
        super("IDEMPOTENCY_CONFLICT", "Idempotency-Key นี้ถูกใช้กับข้อมูล Ticket อื่นแล้ว");
        this.name = "ITTicketIdempotencyConflictError";
    }
}

export class ITTicketAssigneeNotEligibleError extends ITTicketError {
    constructor() {
        super("ASSIGNEE_NOT_ELIGIBLE", "ผู้รับผิดชอบไม่มีคุณสมบัติตามที่กำหนด");
        this.name = "ITTicketAssigneeNotEligibleError";
    }
}

export class ITTicketCategoryNotFoundError extends ITTicketError {
    constructor() {
        super("CATEGORY_NOT_FOUND", "ไม่พบหมวดหมู่ Ticket ที่ระบุ");
        this.name = "ITTicketCategoryNotFoundError";
    }
}

export class ITTicketCategoryInactiveError extends ITTicketError {
    constructor() {
        super("CATEGORY_INACTIVE", "หมวดหมู่ Ticket นี้ปิดใช้งานแล้ว");
        this.name = "ITTicketCategoryInactiveError";
    }
}
