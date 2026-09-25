import { ITTicketStatus, ITTicketType } from "@prisma/client";
import { z } from "zod";

import {
    IT_TICKET_DESCRIPTION_MAX_LENGTH,
    IT_TICKET_DATABASE_INT_MAX,
    IT_TICKET_TITLE_MAX_LENGTH,
} from "../contracts";

export { IT_TICKET_DESCRIPTION_MAX_LENGTH, IT_TICKET_TITLE_MAX_LENGTH };

export const createITTicketInputSchema = z.object({
    type: z.nativeEnum(ITTicketType),
    title: z.string()
        .trim()
        .min(1, "กรุณาระบุหัวข้อ Ticket")
        .max(IT_TICKET_TITLE_MAX_LENGTH, "หัวข้อ Ticket ต้องไม่เกิน 200 ตัวอักษร"),
    description: z.string()
        .trim()
        .min(1, "กรุณาระบุรายละเอียด Ticket")
        .max(IT_TICKET_DESCRIPTION_MAX_LENGTH, "รายละเอียด Ticket ต้องไม่เกิน 10,000 ตัวอักษร"),
}).strict();

export const transitionITTicketStatusInputSchema = z.object({
    ticketId: z.number().int().positive().max(IT_TICKET_DATABASE_INT_MAX),
    targetStatus: z.nativeEnum(ITTicketStatus),
    expectedVersion: z.number().int().positive().max(IT_TICKET_DATABASE_INT_MAX),
}).strict();

export const assignITTicketInputSchema = z.object({
    ticketId: z.number().int().positive().max(IT_TICKET_DATABASE_INT_MAX),
    assigneeUserId: z.number().int().positive().max(IT_TICKET_DATABASE_INT_MAX).nullable(),
    expectedVersion: z.number().int().positive().max(IT_TICKET_DATABASE_INT_MAX),
}).strict();

export const setITTicketCategoryInputSchema = z.object({
    ticketId: z.number().int().positive().max(IT_TICKET_DATABASE_INT_MAX),
    categoryId: z.number().int().positive().max(IT_TICKET_DATABASE_INT_MAX).nullable(),
    expectedVersion: z.number().int().positive().max(IT_TICKET_DATABASE_INT_MAX),
}).strict();

export const transitionITTicketStatusBodySchema =
    transitionITTicketStatusInputSchema.omit({ ticketId: true });
export const assignITTicketBodySchema = assignITTicketInputSchema.omit({ ticketId: true });
export const setITTicketCategoryBodySchema = setITTicketCategoryInputSchema.omit({
    ticketId: true,
});

export type CreateITTicketInput = z.infer<typeof createITTicketInputSchema>;
export type TransitionITTicketStatusInput = z.infer<
    typeof transitionITTicketStatusInputSchema
>;
export type AssignITTicketInput = z.infer<typeof assignITTicketInputSchema>;
export type SetITTicketCategoryInput = z.infer<typeof setITTicketCategoryInputSchema>;
