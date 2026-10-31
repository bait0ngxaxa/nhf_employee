import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { runSerializableTransaction } from "@/lib/db/transaction";
import { cleanCalendarDefaultFixtures } from "./calendar-cleanup";
import { createCalendarFixture, type CalendarFixture } from "./calendar-fixture";
import { getManagedHolidayCalendar, getPublishedHolidayCalendar, mutateHolidayCalendar } from "../../application/calendar/calendar";
import { ensureHolidayCalendarInTransaction } from "../../application/calendar/defaults";
import { calculateEffectiveLeaveInTransaction, previewLeaveCalculation } from "../../application/calendar/calculation";
import { buildLeaveAuthorizationContext } from "../../application/authorization";
import { getBuiltInHolidayCalendar } from "../../domain/holiday-defaults";

describe.sequential("automatic annual defaults on dedicated MySQL", () => {
    let f: CalendarFixture;
    beforeAll(async () => {
        f = await createCalendarFixture(); // includes the dedicated test database guard
        if (await prisma.holidayCalendar.count({ where: { year: { in: [2026, 2027] } } })) {
            throw new Error("Default-calendar fixtures require unused 2026/2027 test years");
        }
    });
    afterAll(cleanCalendarDefaultFixtures);
    afterEach(() => vi.unstubAllEnvs());

    it.each([2026, 2027])("initializes %i concurrently exactly once, without ADMIN or quota changes", async (year) => {
        const requestsBefore = await prisma.leaveRequest.count();
        const quotasBefore = await prisma.leaveQuota.findMany({ orderBy: { id: "asc" } });
        const results = await Promise.all(Array.from({ length: 5 }, () => getPublishedHolidayCalendar(year)));
        expect(results.every((result) => result.version === 1)).toBe(true);
        expect(results[0].days.map((day) => day.date)).toEqual(getBuiltInHolidayCalendar(year)?.days.map((day) => day.date));
        expect(await prisma.holidayCalendarVersion.count({ where: { year } })).toBe(1);
        const version = await prisma.holidayCalendarVersion.findFirstOrThrow({ where: { year } });
        expect(version).toMatchObject({ createdById: null, publishedById: null, defaultDatasetRevision: `bot-${year}-r1`, publishedAt: expect.any(Date) });
        const audit = await prisma.auditLog.findMany({ where: { entityType: "HolidayCalendar", entityId: year, action: "LEAVE_CALENDAR_PUBLISH" } });
        expect(audit).toHaveLength(1);
        expect(audit[0].userId).toBeNull();
        expect(JSON.parse(audit[0].details ?? "{}")).toMatchObject({ metadata: { actor: "SYSTEM", datasetRevision: `bot-${year}-r1` } });
        expect(await prisma.leaveRequest.count()).toBe(requestsBefore);
        expect(await prisma.leaveQuota.findMany({ orderBy: { id: "asc" } })).toEqual(quotasBefore);
        await expect(prisma.holidayCalendarVersion.update({ where: { id: version.id }, data: { defaultDatasetRevision: "modified" } })).rejects.toThrow();
        await expect(prisma.holidayCalendarDay.deleteMany({ where: { versionId: version.id } })).rejects.toThrow();
    });

    it("uses defaults for identical Dashboard/LIFF projections after normal feature activation", async () => {
        vi.stubEnv("LEAVE_HOLIDAY_CALENDAR_ENABLED", "true");
        const payload = { startDate: "2027-02-19", endDate: "2027-02-23", period: "FULL_DAY", leaveType: "VACATION" };
        const web = await previewLeaveCalculation(f.owner.authorization, payload);
        const liff = await previewLeaveCalculation(buildLeaveAuthorizationContext({ id: f.owner.userId, role: "USER" }, f.owner.employeeId, "LIFF_SELF_SERVICE"), payload);
        expect(web).toEqual(liff);
        expect(web).toMatchObject({ mode: "PUBLISHED_CALENDAR", calendarVersion: 1, durationHalfDays: 4 });
    });

    it("fails clearly when neither published nor verified built-in data exists", async () => {
        vi.stubEnv("LEAVE_HOLIDAY_CALENDAR_ENABLED", "true");
        await expect(runSerializableTransaction((tx) => calculateEffectiveLeaveInTransaction(tx, "2028-01-04", "2028-01-04", "MORNING"))).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining("2571") });
        expect(await prisma.holidayCalendar.findUnique({ where: { year: 2028 } })).toBeNull();
    });

    it("copies defaults for customization and permanently prioritizes an ADMIN publication on repeat initialization", async () => {
        const original = await getPublishedHolidayCalendar(2027);
        let managed = await mutateHolidayCalendar(f.admin, { action: "create", year: 2027, expectedActiveVersion: 1 });
        const draft = managed.versions[0];
        expect(draft.days.map((day) => day.date)).toEqual(original.days.map((day) => day.date));
        const days = draft.days.filter((day) => day.date !== "2027-02-22");
        days.push({ date: "2027-02-23", name: "วันหยุด NHF สำหรับทดสอบ", category: "ORGANIZATION", source: "integration fixture", note: "override" });
        managed = await mutateHolidayCalendar(f.admin, { action: "save", year: 2027, versionId: draft.id, revision: 0, days });
        await mutateHolidayCalendar(f.admin, { action: "publish", year: 2027, versionId: draft.id, revision: managed.versions[0].revision, expectedActiveVersion: 1, verified: true, confirmEmpty: false, note: "Explicit NHF fixture customization" });
        const customized = await getPublishedHolidayCalendar(2027);
        await Promise.all(Array.from({ length: 4 }, () => runSerializableTransaction((tx) => ensureHolidayCalendarInTransaction(tx, 2027))));
        expect(await getPublishedHolidayCalendar(2027)).toEqual(customized);
        expect(customized.version).toBe(2);
        expect(customized.days.map((day) => day.date)).not.toContain("2027-02-22");
        expect(customized.days.map((day) => day.date)).toContain("2027-02-23");
        expect((await getManagedHolidayCalendar(f.admin, 2027)).versions.find((version) => version.number === 1)?.days.map((day) => day.date)).toEqual(original.days.map((day) => day.date));
        expect(await prisma.holidayCalendarVersion.count({ where: { year: 2027 } })).toBe(2);
    });
});
