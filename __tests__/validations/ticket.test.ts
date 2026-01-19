import { describe, it, expect } from "vitest";
import {
    createTicketSchema,
    updateTicketSchema,
    TICKET_CATEGORIES,
} from "@/lib/validations/ticket";

describe("Ticket Validation", () => {
    describe("createTicketSchema", () => {
        it("should validate valid ticket", () => {
            const data = {
                title: "Help",
                description: "Issue",
                category: "SOFTWARE",
                priority: "HIGH",
            };
            const result = createTicketSchema.safeParse(data);
            expect(result.success).toBe(true);
        });

        it("should fail on invalid category", () => {
            const data = {
                title: "Help",
                description: "Issue",
                category: "INVALID_CAT",
                priority: "HIGH",
            };
            const result = createTicketSchema.safeParse(data);
            expect(result.success).toBe(false);
        });
    });

    describe("updateTicketSchema", () => {
        it("should allow status update", () => {
            const result = updateTicketSchema.safeParse({ status: "RESOLVED" });
            expect(result.success).toBe(true);
        });

        it("should convert assignedToId string to number", () => {
            const result = updateTicketSchema.safeParse({ assignedToId: "99" });
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data.assignedToId).toBe(99);
            }
        });
    });
});
