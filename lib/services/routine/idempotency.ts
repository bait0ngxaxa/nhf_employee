import { createHash } from "node:crypto";

import type { RoutineTaskCreateInput } from "@/lib/validations/routine";

import { RoutineConflictError } from "./errors";

export class RoutineIdempotencyConflictError extends RoutineConflictError {
    constructor() {
        super("Idempotency-Key นี้ถูกใช้กับข้อมูล Routine อื่นแล้ว");
        this.name = "RoutineIdempotencyConflictError";
    }
}

export function createRoutineTaskRequestHash(
    input: RoutineTaskCreateInput,
): string {
    return createHash("sha256")
        .update(JSON.stringify(input))
        .digest("hex");
}

export function assertMatchingRoutineTaskIdempotency(
    requestHash: string,
    storedHash: string,
): void {
    if (requestHash !== storedHash) {
        throw new RoutineIdempotencyConflictError();
    }
}
