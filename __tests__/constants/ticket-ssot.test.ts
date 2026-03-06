import { describe, expect, it } from "vitest";
import { TicketCategory, TicketPriority, TicketStatus } from "@prisma/client";
import {
    TICKET_CATEGORIES as UI_TICKET_CATEGORIES,
    TICKET_PRIORITIES as UI_TICKET_PRIORITIES,
    TICKET_STATUSES as UI_TICKET_STATUSES,
} from "@/constants/tickets";
import {
    TICKET_CATEGORIES as VALIDATION_TICKET_CATEGORIES,
    TICKET_PRIORITIES as VALIDATION_TICKET_PRIORITIES,
    TICKET_STATUSES as VALIDATION_TICKET_STATUSES,
} from "@/lib/validations/ticket";

describe("Ticket enum SSOT alignment", () => {
    it("keeps category values aligned across Prisma, UI constants, and validation", () => {
        const prismaCategories = Object.values(TicketCategory);
        const uiCategories = UI_TICKET_CATEGORIES.map((item) => item.value);

        expect(uiCategories).toEqual(prismaCategories);
        expect(VALIDATION_TICKET_CATEGORIES).toEqual(prismaCategories);
    });

    it("keeps priority values aligned across Prisma, UI constants, and validation", () => {
        const prismaPriorities = Object.values(TicketPriority);
        const uiPriorities = UI_TICKET_PRIORITIES.map((item) => item.value);

        expect(uiPriorities).toEqual(prismaPriorities);
        expect(VALIDATION_TICKET_PRIORITIES).toEqual(prismaPriorities);
    });

    it("keeps status values aligned across Prisma, UI constants, and validation", () => {
        const prismaStatuses = Object.values(TicketStatus);
        const uiStatuses = UI_TICKET_STATUSES.map((item) => item.value);

        expect(uiStatuses).toEqual(prismaStatuses);
        expect(VALIDATION_TICKET_STATUSES).toEqual(prismaStatuses);
    });
});

