import { z } from "zod";
import { SHARED_DRIVE_OPTIONS } from "./constants";

export const accessDecisionSchema = z.enum(["UNDECIDED", "NOT_REQUIRED", "REQUIRED"]);
export type AccessDecision = z.infer<typeof accessDecisionSchema>;

export const ACCESS_DECISION_LABELS: Record<AccessDecision, string> = {
    UNDECIDED: "ยังไม่ได้ระบุ",
    NOT_REQUIRED: "ไม่ต้องใช้",
    REQUIRED: "ต้องใช้",
};

export const accessRequirementFields = {
    documentSystemDecision: accessDecisionSchema,
    sharedDriveDecision: accessDecisionSchema,
    sharedDriveAccess: z.array(z.enum(SHARED_DRIVE_OPTIONS))
        .max(SHARED_DRIVE_OPTIONS.length)
        .refine((value) => new Set(value).size === value.length, "ไม่ควรเลือก Shared Drive ซ้ำ"),
};

export type AccessRequirements = z.infer<z.ZodObject<typeof accessRequirementFields>>;

export function validateAccessRequirements(value: AccessRequirements, ctx: z.RefinementCtx): void {
    if ((value.sharedDriveDecision === "REQUIRED") !== (value.sharedDriveAccess.length > 0)) {
        ctx.addIssue({ code: "custom", path: ["sharedDriveAccess"], message: value.sharedDriveDecision === "REQUIRED"
            ? "กรุณาเลือก Shared Drive อย่างน้อยหนึ่งรายการ"
            : "เลือก Shared Drive ได้เฉพาะเมื่อต้องใช้เท่านั้น" });
    }
}

export const accessRequirementsSchema = z.object(accessRequirementFields).strict()
    .superRefine(validateAccessRequirements)
    .transform(normalizeAccessRequirements);

export const updateAccessRequirementsSchema = z.object({
    ...accessRequirementFields,
    expectedAccessVersion: z.number().int().min(1).max(2_147_483_646),
}).strict().superRefine(validateAccessRequirements);
export type UpdateAccessRequirementsInput = z.infer<typeof updateAccessRequirementsSchema>;

export function normalizeAccessRequirements(value: AccessRequirements): AccessRequirements {
    return { ...value, sharedDriveAccess: [...value.sharedDriveAccess].sort() };
}

/** Only the persistence boundary uses this mapping for pre-cutover/null rows. */
export function readStoredAccessRequirements(row: {
    documentSystemDecision: AccessDecision | null;
    sharedDriveDecision: AccessDecision | null;
    needsDocumentSystem: boolean;
    sharedDriveAccess: unknown;
}): AccessRequirements {
    const drives = row.sharedDriveAccess ?? [];
    return accessRequirementsSchema.parse({
        documentSystemDecision: row.documentSystemDecision
            ?? (row.needsDocumentSystem ? "REQUIRED" : "NOT_REQUIRED"),
        sharedDriveDecision: row.sharedDriveDecision
            ?? (Array.isArray(drives) && drives.length > 0 ? "REQUIRED" : "NOT_REQUIRED"),
        sharedDriveAccess: drives,
    });
}
