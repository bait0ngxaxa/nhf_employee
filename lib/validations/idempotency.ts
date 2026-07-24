import { z } from "zod";

export const idempotencyKeySchema = z
    .string()
    .trim()
    .min(1, "กรุณาระบุ Idempotency-Key")
    .max(255, "Idempotency-Key ต้องไม่เกิน 255 ตัวอักษร");
