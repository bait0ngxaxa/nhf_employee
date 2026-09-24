import { ITTicketStatus, ITTicketType } from "@prisma/client";
import { z } from "zod";

export const IT_TICKET_TITLE_MAX_LENGTH = 200;
export const IT_TICKET_DESCRIPTION_MAX_LENGTH = 10_000;

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
    ticketId: z.number().int().positive(),
    targetStatus: z.nativeEnum(ITTicketStatus),
    expectedVersion: z.number().int().positive(),
}).strict();

export const assignITTicketInputSchema = z.object({
    ticketId: z.number().int().positive(),
    assigneeUserId: z.number().int().positive().nullable(),
    expectedVersion: z.number().int().positive(),
}).strict();

export const setITTicketCategoryInputSchema = z.object({
    ticketId: z.number().int().positive(),
    categoryId: z.number().int().positive().nullable(),
    expectedVersion: z.number().int().positive(),
}).strict();

export type CreateITTicketInput = z.infer<typeof createITTicketInputSchema>;
export type TransitionITTicketStatusInput = z.infer<
    typeof transitionITTicketStatusInputSchema
>;
export type AssignITTicketInput = z.infer<typeof assignITTicketInputSchema>;
export type SetITTicketCategoryInput = z.infer<typeof setITTicketCategoryInputSchema>;
