import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanCalendarFixtures } from "./calendar-cleanup";
import { prisma } from "@/lib/db/prisma";
import { getManagedHolidayCalendar, getPublishedHolidayCalendar, mutateHolidayCalendar } from "../../application/calendar/calendar";
import type { CalendarAdminContext } from "../../application/calendar/authorization";

describe.sequential("holiday calendar real MySQL persistence", () => {
    afterAll(cleanCalendarFixtures);
    let admin: CalendarAdminContext;
    let user: CalendarAdminContext;
    let year: number;

    beforeAll(async () => {
        const url = new URL(process.env.DATABASE_URL ?? "");
        if (url.protocol !== "mysql:" || !/(?:_integration|_test)$/.test(url.pathname)) throw new Error("Dedicated MySQL test database required");
        const department = await prisma.department.upsert({ where: { name: "Calendar integration" }, update: {}, create: { name: "Calendar integration", code: "CAL-TEST" } });
        const contexts: CalendarAdminContext[] = [];
        for (const role of ["ADMIN", "USER"] as const) {
            const email = `calendar-${role.toLowerCase()}@integration.test`;
            const employee = await prisma.employee.upsert({ where: { email }, update: {}, create: { firstName: "Calendar", lastName: role, email, position: "Test", departmentId: department.id } });
            const account = await prisma.user.upsert({ where: { email }, update: { role, isActive: true, deletedAt: null }, create: { email, name: role, password: "integration-only", role, employeeId: employee.id } });
            contexts.push({ userId: account.id, channel: "DASHBOARD" });
        }
        [admin, user] = contexts;
        const latest = await prisma.holidayCalendar.findFirst({ where: { year: { gte: 8000, lt: 9000 } }, orderBy: { year: "desc" } });
        year = (latest?.year ?? 7999) + 1;
        if (year >= 9000) throw new Error("Calendar test year space exhausted");
    });

    it("denies USER reads of drafts and all mutations, and inactive/deleted ADMIN", async () => {
        await expect(getManagedHolidayCalendar(user, year)).rejects.toMatchObject({ statusCode: 403 });
        await expect(mutateHolidayCalendar(user, { action: "create", year, expectedActiveVersion: null })).rejects.toMatchObject({ statusCode: 403 });
        for (const data of [{ isActive: false }, { deletedAt: new Date() }, { role: "USER" as const }]) {
            await prisma.user.update({ where: { id: admin.userId }, data });
            await expect(mutateHolidayCalendar(admin, { action: "create", year, expectedActiveVersion: null })).rejects.toMatchObject({ statusCode: 403 });
            await prisma.user.update({ where: { id: admin.userId }, data: { isActive: true, deletedAt: null, role: "ADMIN" } });
        }
        expect(await prisma.holidayCalendar.findUnique({ where: { year } })).toBeNull();
    });

    it("creates, edits, removes, publishes once under concurrency, and preserves immutable snapshots", async () => {
        let calendar = await mutateHolidayCalendar(admin, { action: "create", year, expectedActiveVersion: null });
        const draft = calendar.versions[0];
        const day = { date: `${year}-01-01`, name: "วันทดสอบ ไม่ใช่ข้อมูลวันหยุดจริง", category: "ORGANIZATION", source: `fixture:${randomUUID()}` };
        const save = (days: unknown[], revision: number) => mutateHolidayCalendar(admin, { action: "save", year, versionId: draft.id, revision, days });
        await expect(save([day, day], 0)).rejects.toMatchObject({ statusCode: 400 });
        await expect(save([{ ...day, date: `${year}-02-30` }], 0)).rejects.toMatchObject({ statusCode: 400 });
        await expect(save([{ ...day, date: `${year + 1}-01-01` }], 0)).rejects.toMatchObject({ statusCode: 400 });
        calendar = await save([day], 0);
        await prisma.holidayCalendarDay.updateMany({ where: { versionId: draft.id }, data: { source: " " } });
        await expect(mutateHolidayCalendar(admin, { action: "publish", year, versionId: draft.id, revision: 1, expectedActiveVersion: null, verified: true, confirmEmpty: false, note: "Persisted invalid source must not publish" })).rejects.toMatchObject({ statusCode: 400 });
        await expect(prisma.holidayCalendarDay.create({ data: { year, versionId: draft.id, date: new Date(`${year + 1}-01-01T00:00:00Z`), name: "wrong year fixture", category: "ORGANIZATION", source: "integration only" } })).rejects.toThrow();
        await expect(prisma.holidayCalendarDay.create({ data: { year, versionId: draft.id, date: new Date(`${year}-01-01T00:00:00Z`), name: "duplicate fixture", category: "ORGANIZATION", source: "integration only" } })).rejects.toThrow();
        calendar = await save([{ ...day, name: "แก้ไขชื่อวันทดสอบ" }], 1);
        calendar = await save([], 2);
        expect(calendar.versions[0].days).toEqual([]);
        await expect(mutateHolidayCalendar(admin, { action: "publish", year, versionId: draft.id, revision: 3, expectedActiveVersion: null, verified: true, confirmEmpty: false, note: "must confirm an empty calendar" })).rejects.toMatchObject({ statusCode: 400 });
        calendar = await save([day], 3);
        expect(await getPublishedHolidayCalendar(year)).toEqual({ year, version: null, days: [] });
        const publish = { action: "publish", year, versionId: draft.id, revision: 4, expectedActiveVersion: null, verified: true, confirmEmpty: false, note: "ยืนยันข้อมูลทดสอบ" };
        const results = await Promise.allSettled([mutateHolidayCalendar(admin, publish), mutateHolidayCalendar(admin, publish)]);
        expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
        expect(await getPublishedHolidayCalendar(year)).toMatchObject({ version: 1, days: [{ date: day.date }] });
        await expect(save([], 4)).rejects.toMatchObject({ statusCode: 409 });
        await expect(prisma.holidayCalendarDay.updateMany({ where: { versionId: draft.id }, data: { name: "invalid" } })).rejects.toThrow();
        await expect(prisma.holidayCalendarDay.deleteMany({ where: { versionId: draft.id } })).rejects.toThrow();
        await expect(prisma.holidayCalendarVersion.update({ where: { id: draft.id }, data: { publicationNote: "invalid" } })).rejects.toThrow();
        calendar = await mutateHolidayCalendar(admin, { action: "create", year, expectedActiveVersion: 1 });
        expect(calendar.versions[0]).toMatchObject({ number: 2, publishedAt: null, days: [{ date: day.date }] });
        expect(calendar.versions[1].publishedAt).not.toBeNull();
        expect(await prisma.auditLog.count({ where: { action: "LEAVE_CALENDAR_PUBLISH", entityId: year } })).toBe(1);
    });
});
