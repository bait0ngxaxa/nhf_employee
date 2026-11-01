import { z } from "zod";

// Display-only contract. Never use these events as Leave policy inputs.
export const holidayReferenceEventSchema = z.object({
    date: z.iso.date(),
    name: z.string().trim().min(1).max(500),
    classification: z.enum(["public-holiday", "observance", "unverified"]),
});

export const holidayReferenceSchema = z.object({
    year: z.number().int().min(1900).max(9999),
    events: z.array(holidayReferenceEventSchema).min(1).max(2000),
}).refine(({ year, events }) => events.every((event) => event.date.startsWith(`${year}-`)));

export type HolidayReferenceEvent = z.infer<typeof holidayReferenceEventSchema>;
export type HolidayReference = z.infer<typeof holidayReferenceSchema>;
