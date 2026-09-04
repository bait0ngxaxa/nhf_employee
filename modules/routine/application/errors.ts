export type RoutineErrorCode =
    | "NOT_FOUND"
    | "FORBIDDEN"
    | "VALIDATION"
    | "CONFLICT";

export class RoutineServiceError extends Error {
    readonly statusCode: number;
    readonly code: RoutineErrorCode;

    constructor(
        message: string,
        statusCode: number,
        code: RoutineErrorCode,
    ) {
        super(message);
        this.name = "RoutineServiceError";
        this.statusCode = statusCode;
        this.code = code;
    }
}

export class RoutineNotFoundError extends RoutineServiceError {
    constructor(message = "ไม่พบงานประจำ") {
        super(message, 404, "NOT_FOUND");
    }
}

export class RoutineForbiddenError extends RoutineServiceError {
    constructor(message = "คุณไม่มีสิทธิ์ดำเนินการกับงานนี้") {
        super(message, 403, "FORBIDDEN");
    }
}

export class RoutineValidationError extends RoutineServiceError {
    constructor(message = "ข้อมูล NHF Routine ไม่ถูกต้อง") {
        super(message, 400, "VALIDATION");
    }
}

export class RoutineConflictError extends RoutineServiceError {
    constructor(message = "รายการถูกเปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลใหม่") {
        super(message, 409, "CONFLICT");
    }
}
