import type { Prisma } from "@prisma/client";
import { runSerializableTransaction } from "@/lib/db/transaction";
import { appendAuditInTransaction } from "@/modules/audit";
import { toDateOnlyString, toUtcDate } from "../../domain/business-date";
import { calendarMutationSchema, HolidayCalendarError, validateHolidayDays, type ManagedHolidayCalendar, type PublishedHolidayCalendar } from "../../domain/holiday-calendar";
import { assertCalendarAdmin, type CalendarAdminContext } from "./authorization";
import { ensureHolidayCalendarInTransaction, lockHolidayCalendar } from "./defaults";

export { lockHolidayCalendar } from "./defaults";

async function managedInTransaction(tx: Prisma.TransactionClient, year: number): Promise<ManagedHolidayCalendar> {
    const calendar = await tx.holidayCalendar.findUnique({
        where: { year }, include: { versions: { orderBy: { number: "desc" }, include: { days: { orderBy: { date: "asc" } } } } },
    });
    return {
        year, activeVersionNumber: calendar?.activeVersionNumber ?? null,
        versions: (calendar?.versions ?? []).map((version) => ({
            id: version.id, number: version.number, revision: version.revision,
            publishedAt: version.publishedAt?.toISOString() ?? null,
            publicationNote: version.publicationNote,
            days: version.days.map((day) => ({ date: toDateOnlyString(day.date), name: day.name, category: day.category, source: day.source, note: day.note ?? "" })),
        })),
    };
}

export async function getManagedHolidayCalendar(context: CalendarAdminContext, year: number): Promise<ManagedHolidayCalendar> {
    return runSerializableTransaction(async (tx) => {
        await assertCalendarAdmin(tx, context);
        await ensureHolidayCalendarInTransaction(tx, year);
        return managedInTransaction(tx, year);
    });
}

export async function getPublishedHolidayCalendar(year: number): Promise<PublishedHolidayCalendar> {
    return runSerializableTransaction(async (tx) => {
        await ensureHolidayCalendarInTransaction(tx, year);
        const calendar = await tx.holidayCalendar.findUnique({ where: { year }, include: { activeVersion: { include: { days: { orderBy: { date: "asc" } } } } } });
        return {
            year, version: calendar?.activeVersion?.number ?? null,
            days: (calendar?.activeVersion?.days ?? []).map((day) => ({ date: toDateOnlyString(day.date), name: day.name, category: day.category })),
        };
    });
}

export async function mutateHolidayCalendar(context: CalendarAdminContext, raw: unknown): Promise<ManagedHolidayCalendar> {
    const parsed = calendarMutationSchema.safeParse(raw);
    if (!parsed.success) throw new HolidayCalendarError("ข้อมูลปฏิทินไม่ถูกต้อง กรุณาตรวจปี วันที่ และแหล่งอ้างอิง", 400);
    const input = parsed.data;
    if (input.action === "save") validateHolidayDays(input.year, input.days);
    return runSerializableTransaction(async (tx) => {
        const actor = await assertCalendarAdmin(tx, context);
        // Upsert serializes first creation too. Existing calendars are never reset.
        await tx.holidayCalendar.upsert({ where: { year: input.year }, create: { year: input.year }, update: {} });
        await lockHolidayCalendar(tx, input.year);
        await ensureHolidayCalendarInTransaction(tx, input.year);
        const before = await managedInTransaction(tx, input.year);
        if (input.action === "create") {
            if (before.activeVersionNumber !== input.expectedActiveVersion) throw new HolidayCalendarError("ปฏิทินเปลี่ยนแล้ว กรุณาโหลดใหม่");
            if (before.versions.some((version) => !version.publishedAt)) throw new HolidayCalendarError("มีฉบับร่างอยู่แล้ว กรุณาแก้ไขฉบับร่างเดิม");
            const active = before.versions.find((version) => version.number === before.activeVersionNumber);
            const number = Math.max(0, ...before.versions.map((version) => version.number)) + 1;
            await tx.holidayCalendarVersion.create({ data: {
                year: input.year, number, createdById: actor.id, baseVersionNumber: before.activeVersionNumber,
                days: { create: (active?.days ?? []).map((day) => ({ ...day, date: toUtcDate(day.date) })) },
            } });
        } else {
            const draft = before.versions.find((version) => version.id === input.versionId);
            if (!draft) throw new HolidayCalendarError("ไม่พบฉบับร่าง", 404);
            if (draft.publishedAt) throw new HolidayCalendarError("แก้ไขฉบับเผยแพร่ไม่ได้ กรุณาสร้างฉบับแก้ไขใหม่");
            if (draft.revision !== input.revision) throw new HolidayCalendarError("ฉบับร่างเปลี่ยนแล้ว กรุณาโหลดใหม่");
            if (input.action === "save") {
                await tx.holidayCalendarDay.deleteMany({ where: { versionId: draft.id } });
                await tx.holidayCalendarDay.createMany({ data: input.days.map((day) => ({ ...day, year: input.year, versionId: draft.id, date: toUtcDate(day.date) })) });
                await tx.holidayCalendarVersion.update({ where: { id: draft.id }, data: { revision: { increment: 1 } } });
            } else {
                if (before.activeVersionNumber !== input.expectedActiveVersion) throw new HolidayCalendarError("ฉบับเผยแพร่เปลี่ยนแล้ว กรุณาทบทวนใหม่");
                validateHolidayDays(input.year, draft.days);
                if (draft.days.length === 0 && !input.confirmEmpty) throw new HolidayCalendarError("กรุณายืนยันว่าปีนี้ไม่มีวันหยุดองค์กร", 400);
                await tx.holidayCalendarVersion.update({ where: { id: draft.id }, data: { publishedAt: new Date(), publishedById: actor.id, publicationNote: input.note } });
                await tx.holidayCalendar.update({ where: { year: input.year }, data: { activeVersionNumber: draft.number } });
            }
        }
        const after = await managedInTransaction(tx, input.year);
        await appendAuditInTransaction(tx, {
            action: input.action === "publish" ? "LEAVE_CALENDAR_PUBLISH" : "LEAVE_CALENDAR_DRAFT",
            entityType: "HolidayCalendar", entityId: input.year, userId: actor.id, userEmail: actor.email,
            details: { before: { activeVersion: before.activeVersionNumber }, after: { activeVersion: after.activeVersionNumber }, metadata: { action: input.action, year: input.year, versionId: input.action === "create" ? after.versions[0]?.id : input.versionId, revision: input.action === "create" ? 0 : input.revision } },
        });
        return after;
    });
}
