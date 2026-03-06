import { TicketCategory, TicketPriority, TicketStatus } from "@prisma/client";
import { z } from "zod";

export const TICKET_CATEGORIES = Object.values(TicketCategory);
export const TICKET_PRIORITIES = Object.values(TicketPriority);
export const TICKET_STATUSES = Object.values(TicketStatus);

const emptyToUndefined = (value: unknown): unknown =>
    value === "" || value === null ? undefined : value;

export const ticketFiltersSchema = z.object({
    status: z.preprocess(
        emptyToUndefined,
        z.nativeEnum(TicketStatus).optional(),
    ),
    category: z.preprocess(
        emptyToUndefined,
        z.nativeEnum(TicketCategory).optional(),
    ),
    priority: z.preprocess(
        emptyToUndefined,
        z.nativeEnum(TicketPriority).optional(),
    ),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const createTicketSchema = z.object({
    title: z
        .string({ message: "เธเธฃเธธเธ“เธฒเธเธฃเธญเธเธซเธฑเธงเธเนเธญ" })
        .min(1, "เธเธฃเธธเธ“เธฒเธเธฃเธญเธเธซเธฑเธงเธเนเธญ")
        .max(200, "เธซเธฑเธงเธเนเธญเธ•เนเธญเธเนเธกเนเน€เธเธดเธ 200 เธ•เธฑเธงเธญเธฑเธเธฉเธฃ")
        .trim(),
    description: z
        .string({ message: "เธเธฃเธธเธ“เธฒเธเธฃเธญเธเธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”" })
        .min(1, "เธเธฃเธธเธ“เธฒเธเธฃเธญเธเธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”")
        .max(5000, "เธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เธ•เนเธญเธเนเธกเนเน€เธเธดเธ 5000 เธ•เธฑเธงเธญเธฑเธเธฉเธฃ")
        .trim(),
    category: z.nativeEnum(TicketCategory, {
        message: "เธเธฃเธธเธ“เธฒเน€เธฅเธทเธญเธเธเธฃเธฐเน€เธ เธ—เธเธฑเธเธซเธฒ",
    }),
    priority: z
        .nativeEnum(TicketPriority, {
            message: "เธฃเธฐเธ”เธฑเธเธเธงเธฒเธกเน€เธฃเนเธเธ”เนเธงเธเนเธกเนเธ–เธนเธเธ•เนเธญเธ",
        })
        .default(TicketPriority.MEDIUM),
});

export const updateTicketSchema = z.object({
    title: z
        .string()
        .min(1, "เธเธฃเธธเธ“เธฒเธเธฃเธญเธเธซเธฑเธงเธเนเธญ")
        .max(200, "เธซเธฑเธงเธเนเธญเธ•เนเธญเธเนเธกเนเน€เธเธดเธ 200 เธ•เธฑเธงเธญเธฑเธเธฉเธฃ")
        .trim()
        .optional(),
    description: z
        .string()
        .min(1, "เธเธฃเธธเธ“เธฒเธเธฃเธญเธเธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”")
        .max(5000, "เธฃเธฒเธขเธฅเธฐเน€เธญเธตเธขเธ”เธ•เนเธญเธเนเธกเนเน€เธเธดเธ 5000 เธ•เธฑเธงเธญเธฑเธเธฉเธฃ")
        .trim()
        .optional(),
    category: z
        .nativeEnum(TicketCategory, {
            message: "เธเธฃเธฐเน€เธ เธ—เธเธฑเธเธซเธฒเนเธกเนเธ–เธนเธเธ•เนเธญเธ",
        })
        .optional(),
    priority: z
        .nativeEnum(TicketPriority, {
            message: "เธฃเธฐเธ”เธฑเธเธเธงเธฒเธกเน€เธฃเนเธเธ”เนเธงเธเนเธกเนเธ–เธนเธเธ•เนเธญเธ",
        })
        .optional(),
    status: z
        .nativeEnum(TicketStatus, {
            message: "เธชเธ–เธฒเธเธฐเนเธกเนเธ–เธนเธเธ•เนเธญเธ",
        })
        .optional(),
    resolution: z
        .string()
        .max(5000, "เธเธฒเธฃเนเธเนเนเธเธ•เนเธญเธเนเธกเนเน€เธเธดเธ 5000 เธ•เธฑเธงเธญเธฑเธเธฉเธฃ")
        .trim()
        .nullish(),
    assignedToId: z
        .union([z.string(), z.number()])
        .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
        .refine((val) => !isNaN(val) && val > 0, {
            message: "เธเธนเนเธฃเธฑเธเธเธดเธ”เธเธญเธเนเธกเนเธ–เธนเธเธ•เนเธญเธ",
        })
        .nullish(),
});

// Inferred types for use in API routes
export type TicketFiltersInput = z.infer<typeof ticketFiltersSchema>;
export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;

