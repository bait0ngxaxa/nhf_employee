import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanCalendarFixtures } from "./calendar-cleanup";
import { prisma } from "@/lib/db/prisma";
import { decideLeaveRequest } from "../../application/approvals/decision";
import { cancelLeaveRequest } from "../../application/cancellation/cancellation";
import { previewLeaveCalculation } from "../../application/calendar/calculation";
import { mutateHolidayCalendar } from "../../application/calendar/calendar";
import { buildLeaveAuthorizationContext } from "../../application/authorization";
import { calendarDraft, createCalendarFixture, holiday, publishCalendar, publishInput, requestCalendarLeave, type CalendarFixture } from "./calendar-fixture";

describe.sequential("calendar-aware lifecycle with real MySQL", () => {
    afterAll(cleanCalendarFixtures);
    let f: CalendarFixture;
    beforeEach(async () => { vi.stubEnv("LEAVE_HOLIDAY_CALENDAR_ENABLED", "true"); f = await createCalendarFixture(); });
    afterEach(() => vi.unstubAllEnvs());

    it("fails closed for an unconfigured year and for draft-only dates", async () => {
        await expect(requestCalendarLeave(f)).rejects.toMatchObject({ statusCode: 409 });
        await calendarDraft(f, [holiday(f.middle)]);
        await expect(requestCalendarLeave(f)).rejects.toMatchObject({ statusCode: 409 });
        expect(await prisma.leaveRequest.count({ where: { employeeId: f.owner.employeeId } })).toBe(0);
    });

    it("uses identical Dashboard and LIFF authoritative previews, does not write preview quotas and charges only at approval", async () => {
        const versionId = await publishCalendar(f, [holiday(f.middle)]);
        const payload = { startDate: f.start, endDate: f.end, period: "FULL_DAY", leaveType: "VACATION" };
        const web = await previewLeaveCalculation(f.owner.authorization, payload);
        const liff = await previewLeaveCalculation(buildLeaveAuthorizationContext({ id: f.owner.userId, role: "USER" }, f.owner.employeeId, "LIFF_SELF_SERVICE"), payload);
        expect(web).toEqual(liff);
        expect(web).toMatchObject({ durationHalfDays: 4, calendarVersionId: versionId });
        expect(await prisma.leaveQuota.count({ where: { employeeId: f.owner.employeeId } })).toBe(0);
        const { request } = await requestCalendarLeave(f);
        expect(request.durationHalfDays).toBe(4);
        expect(request.calculationCalendarVersionId).toBe(versionId);
        expect((await prisma.leaveQuota.findFirstOrThrow({ where: { employeeId: f.owner.employeeId } })).usedHalfDays).toBe(0);
        const approved = await decideLeaveRequest(f.approver, { leaveId: request.id, action: "APPROVE" });
        expect(approved.approvalCalendarVersionId).toBe(versionId);
        expect((await prisma.leaveQuota.findFirstOrThrow({ where: { employeeId: f.owner.employeeId } })).usedHalfDays).toBe(4);
    });

    it("preserves complementary half-day occupancy with calendar enforcement active", async () => {
        await publishCalendar(f, [holiday(f.middle)]);
        await requestCalendarLeave(f, { endDate: f.start, period: "MORNING" });
        await requestCalendarLeave(f, { endDate: f.start, period: "AFTERNOON", leaveType: "PERSONAL" });
        await expect(requestCalendarLeave(f, { endDate: f.start, period: "MORNING", leaveType: "SICK" })).rejects.toMatchObject({ statusCode: 409 });
        await expect(requestCalendarLeave(f, { endDate: f.start, period: "AFTERNOON" })).rejects.toMatchObject({ statusCode: 409 });
        await expect(requestCalendarLeave(f, { endDate: f.start, period: "FULL_DAY" })).rejects.toMatchObject({ statusCode: 409 });
    });

    it.each(["MORNING", "AFTERNOON", "FULL_DAY"] as const)("rejects %s entirely on a published holiday", async (period) => {
        await publishCalendar(f, [holiday(f.start)]);
        await expect(requestCalendarLeave(f, { startDate: f.start, endDate: f.start, period })).rejects.toMatchObject({ statusCode: 400 });
    });

    it("blocks affected pending approval, preserves original details, and allows cancel/resubmit", async () => {
        await publishCalendar(f);
        const { request } = await requestCalendarLeave(f);
        await publishCalendar(f, [holiday(f.middle)]);
        await expect(decideLeaveRequest(f.approver, { leaveId: request.id, action: "APPROVE" })).rejects.toMatchObject({ statusCode: 409 });
        expect(await prisma.leaveRequest.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({ durationHalfDays: 6, status: "PENDING", startDate: request.startDate, reason: request.reason });
        await cancelLeaveRequest(f.owner, request.id);
        expect((await requestCalendarLeave(f)).request.durationHalfDays).toBe(4);
    });

    it("blocks invalidated endpoints even when duration happened to remain unchanged", async () => {
        await publishCalendar(f, [holiday(f.middle)]);
        const { request } = await requestCalendarLeave(f);
        await publishCalendar(f, [holiday(f.start)]);
        await expect(decideLeaveRequest(f.approver, { leaveId: request.id, action: "APPROVE" })).rejects.toMatchObject({ statusCode: 409 });
    });

    it("approves an unaffected pending request using the latest version", async () => {
        await publishCalendar(f);
        const { request } = await requestCalendarLeave(f, { endDate: f.start });
        const versionId = await publishCalendar(f, [holiday(f.middle)]);
        expect(await decideLeaveRequest(f.approver, { leaveId: request.id, action: "APPROVE" })).toMatchObject({ status: "APPROVED", durationHalfDays: 2, approvalCalendarVersionId: versionId });
    });

    it("serializes publication against submission and replays the original idempotency result", async () => {
        const originalVersion = await publishCalendar(f);
        const draft = await calendarDraft(f, [holiday(f.middle)]);
        const key = `calendar-race-${f.year}`;
        const outcomes = await Promise.all([requestCalendarLeave(f, {}, key), mutateHolidayCalendar(f.admin, publishInput(f, draft))]);
        const request = outcomes[0].request;
        expect([originalVersion, draft.id]).toContain(request.calculationCalendarVersionId);
        expect(request.durationHalfDays).toBe(request.calculationCalendarVersionId === originalVersion ? 6 : 4);
        expect((await requestCalendarLeave(f, {}, key)).request.id).toBe(request.id);
        expect(await prisma.notificationOutbox.count({ where: { payload: { contains: request.id } } })).toBe(1);
        expect(await prisma.leaveRequest.count({ where: { employeeId: f.owner.employeeId } })).toBe(1);
    });
});
