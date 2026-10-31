import type { Prisma } from "@prisma/client";
import { appendAuditInTransaction } from "@/modules/audit";
import { getBuiltInHolidayCalendar } from "../../domain/holiday-defaults";
import { toUtcDate } from "../../domain/business-date";

export async function lockHolidayCalendar(tx: Prisma.TransactionClient, year: number): Promise<void> {
    await tx.$queryRaw`SELECT year FROM holiday_calendars WHERE year = ${year} FOR UPDATE`;
}

/** Called inside the caller's serializable transaction; the annual lock lasts until commit. */
export async function ensureHolidayCalendarInTransaction(tx: Prisma.TransactionClient, year: number): Promise<void> {
    const dataset = getBuiltInHolidayCalendar(year);
    if (dataset) {
        // Atomic first creation avoids find-then-create races. No existing active version is reset.
        await tx.$executeRaw`INSERT INTO holiday_calendars (year, updatedAt) VALUES (${year}, NOW(3)) ON DUPLICATE KEY UPDATE year = year`;
    }
    await lockHolidayCalendar(tx, year);
    if (!dataset) return;
    const calendar = await tx.holidayCalendar.findUniqueOrThrow({ where: { year } });
    if (calendar.activeVersionNumber !== null) return;
    const latest = await tx.holidayCalendarVersion.findFirst({ where: { year }, orderBy: { number: "desc" }, select: { number: true } });
    const version = await tx.holidayCalendarVersion.create({ data: {
        year, number: (latest?.number ?? 0) + 1,
        defaultDatasetRevision: dataset.revision,
        publicationNote: `SYSTEM: ${dataset.revision}; ${dataset.source}; ${dataset.note}`,
        days: { create: dataset.days.map((day) => ({ ...day, date: toUtcDate(day.date) })) },
    } });
    // Insert days before publishing: existing database immutability triggers remain authoritative.
    await tx.holidayCalendarVersion.update({ where: { id: version.id }, data: { publishedAt: new Date() } });
    await tx.holidayCalendar.update({ where: { year }, data: { activeVersionNumber: version.number } });
    await appendAuditInTransaction(tx, {
        action: "LEAVE_CALENDAR_PUBLISH", entityType: "HolidayCalendar", entityId: year, userId: null,
        details: { after: { activeVersion: version.number }, metadata: { actor: "SYSTEM", action: "initialize-default", year, versionId: version.id, datasetRevision: dataset.revision, source: dataset.source } },
    });
}
