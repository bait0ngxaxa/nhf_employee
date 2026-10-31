import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { cleanCalendarFixtures } from "./calendar-cleanup";
import { calendarDraft, createCalendarFixture, holiday, publishCalendar, publishInput, requestCalendarLeave, type CalendarFixture } from "./calendar-fixture";
import { getManagedHolidayCalendar, mutateHolidayCalendar } from "../../application/calendar/calendar";

describe.sequential("calendar customization no-history fast path", () => {
    let f: CalendarFixture;
    beforeEach(async () => { vi.stubEnv("LEAVE_HOLIDAY_CALENDAR_ENABLED", "true"); f = await createCalendarFixture(); });
    afterEach(() => vi.unstubAllEnvs());
    afterAll(cleanCalendarFixtures);

    it("publishes without impact review only when the selected year has no requests", async () => {
        const draft = await calendarDraft(f, [holiday(f.middle)]);
        expect((await getManagedHolidayCalendar(f.admin, f.year)).hasLeaveRequests).toBe(false);
        const published = await mutateHolidayCalendar(f.admin, { ...publishInput(f, draft), skipImpactReview: true });
        expect(published.activeVersionNumber).toBe(1);
        expect(await prisma.leaveRequest.count({ where: { employeeId: f.owner.employeeId } })).toBe(0);
        expect(await prisma.leaveQuota.count({ where: { employeeId: f.owner.employeeId } })).toBe(0);
    });

    it("rejects a stale no-history fast path atomically if a request was submitted after loading the editor", async () => {
        await publishCalendar(f);
        const draft = await calendarDraft(f, [holiday(f.middle)]);
        expect((await getManagedHolidayCalendar(f.admin, f.year)).hasLeaveRequests).toBe(false);
        const { request } = await requestCalendarLeave(f);
        const before = await prisma.leaveRequest.findUniqueOrThrow({ where: { id: request.id } });
        const quota = await prisma.leaveQuota.findMany({ where: { employeeId: f.owner.employeeId } });
        const auditCount = await prisma.auditLog.count({ where: { action: "LEAVE_CALENDAR_PUBLISH", entityId: f.year } });
        await expect(mutateHolidayCalendar(f.admin, { ...publishInput(f, draft), skipImpactReview: true })).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining("ตรวจผลกระทบ") });
        expect((await getManagedHolidayCalendar(f.admin, f.year)).hasLeaveRequests).toBe(true);
        expect((await prisma.holidayCalendar.findUniqueOrThrow({ where: { year: f.year } })).activeVersionNumber).toBe(1);
        expect((await prisma.holidayCalendarVersion.findUniqueOrThrow({ where: { id: draft.id } })).publishedAt).toBeNull();
        expect(await prisma.leaveRequest.findUniqueOrThrow({ where: { id: request.id } })).toEqual(before);
        expect(await prisma.leaveQuota.findMany({ where: { employeeId: f.owner.employeeId } })).toEqual(quota);
        expect(await prisma.auditLog.count({ where: { action: "LEAVE_CALENDAR_PUBLISH", entityId: f.year } })).toBe(auditCount);
        await mutateHolidayCalendar(f.admin, publishInput(f, draft)); // ordinary review/reconciliation path remains available
        expect(await prisma.leaveRequest.findUniqueOrThrow({ where: { id: request.id } })).toEqual(before);
    });

    it("serializes the no-history fast path against a concurrent submission", async () => {
        const originalVersion = await publishCalendar(f);
        const draft = await calendarDraft(f, [holiday(f.middle)]);
        const outcomes = await Promise.allSettled([
            requestCalendarLeave(f),
            mutateHolidayCalendar(f.admin, { ...publishInput(f, draft), skipImpactReview: true }),
        ]);
        const submission = outcomes[0];
        expect(submission.status).toBe("fulfilled");
        if (submission.status !== "fulfilled") throw submission.reason;
        const request = submission.value.request;
        if (outcomes[1].status === "fulfilled") {
            expect(request.calculationCalendarVersionId).toBe(draft.id);
            expect(request.durationHalfDays).toBe(4);
        } else {
            expect(outcomes[1].reason).toMatchObject({ statusCode: 409 });
            expect(request.calculationCalendarVersionId).toBe(originalVersion);
            expect(request.durationHalfDays).toBe(6);
        }
        expect((await prisma.leaveQuota.findFirstOrThrow({ where: { employeeId: f.owner.employeeId, year: f.year } })).usedHalfDays).toBe(0);
        expect(await prisma.leaveCalendarAdjustment.count({ where: { leaveRequestId: request.id } })).toBe(0);
    });
});
