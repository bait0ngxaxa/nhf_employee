import { z } from "zod";

export const ANNOUNCEMENT_MAX_LENGTH = 500;
export const announcementContentSchema = z.string().trim().min(1).max(ANNOUNCEMENT_MAX_LENGTH)
    .refine((value) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value), "ข้อความมีอักขระควบคุมที่ไม่รองรับ");
const versionSchema = z.number().int().min(0).max(2147483646);
export const announcementMutationSchema = z.discriminatedUnion("action", [
    z.object({ action: z.literal("save"), content: announcementContentSchema, version: versionSchema }).strict(),
    z.object({ action: z.literal("publish"), content: announcementContentSchema, version: versionSchema }).strict(),
    z.object({ action: z.literal("unpublish"), version: versionSchema }).strict(),
]);
export type AnnouncementMutation = z.infer<typeof announcementMutationSchema>;

export interface AnnouncementState {
    content: string;
    published: boolean;
    version: number;
    authorId: number | null;
    updatedById: number | null;
    createdAt: string;
    updatedAt: string;
}

export class AnnouncementError extends Error {
    constructor(public readonly code: "FORBIDDEN" | "CONFLICT" | "INVALID_INPUT") {
        super(code);
    }
}
