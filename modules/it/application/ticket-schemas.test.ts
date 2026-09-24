import { ITTicketType } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
    createITTicketInputSchema,
    IT_TICKET_DESCRIPTION_MAX_LENGTH,
    IT_TICKET_TITLE_MAX_LENGTH,
} from "./ticket-schemas";

describe("IT Ticket creation input", () => {
    it("trims surrounding whitespace and preserves Thai text", () => {
        expect(createITTicketInputSchema.parse({
            type: ITTicketType.INCIDENT,
            title: "  เครื่องพิมพ์ใช้งานไม่ได้  ",
            description: "  ขอความช่วยเหลือตรวจสอบเครื่องพิมพ์  ",
        })).toEqual({
            type: "INCIDENT",
            title: "เครื่องพิมพ์ใช้งานไม่ได้",
            description: "ขอความช่วยเหลือตรวจสอบเครื่องพิมพ์",
        });
    });

    it("rejects missing, whitespace-only, unapproved, and oversized values", () => {
        expect(createITTicketInputSchema.safeParse({
            type: "INCIDENT",
            title: "  ",
            description: "รายละเอียด",
        }).success).toBe(false);
        expect(createITTicketInputSchema.safeParse({
            type: "ACCESS_REQUEST",
            title: "หัวข้อ",
            description: "รายละเอียด",
        }).success).toBe(false);
        expect(createITTicketInputSchema.safeParse({
            type: "SUGGESTION",
            title: "x".repeat(IT_TICKET_TITLE_MAX_LENGTH + 1),
            description: "รายละเอียด",
        }).success).toBe(false);
        expect(createITTicketInputSchema.safeParse({
            type: "SERVICE_REQUEST",
            title: "หัวข้อ",
            description: "x".repeat(IT_TICKET_DESCRIPTION_MAX_LENGTH + 1),
        }).success).toBe(false);
        expect(createITTicketInputSchema.safeParse({
            type: "SERVICE_REQUEST",
            title: "หัวข้อ",
            description: "รายละเอียด",
            requesterUserId: 42,
        }).success).toBe(false);
    });
});
