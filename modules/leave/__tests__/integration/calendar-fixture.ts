import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { buildLeaveAuthorizationContext } from "../../application/authorization";
import { mutateHolidayCalendar } from "../../application/calendar/calendar";
import { createLeaveRequest } from "../../application/requests/create-request";
import { addCalendarDays, getBusinessDayOfWeek, toDateOnlyString } from "../../domain/business-date";
import type { CalendarAdminContext } from "../../application/calendar/authorization";
import type { HolidayDayInput } from "../../domain/holiday-calendar";

export async function createCalendarFixture(): Promise<{
    year: number; start: string; middle: string; end: string;
    admin: CalendarAdminContext;
    owner: { userId: number; employeeId: number; userEmail: string; authorization: ReturnType<typeof buildLeaveAuthorizationContext> };
    approver: { userId: number; employeeId: number; userEmail: string; name: string; authorization: ReturnType<typeof buildLeaveAuthorizationContext> };
}> {
    const url = new URL(process.env.DATABASE_URL ?? "");
    if (url.protocol !== "mysql:" || !/(?:_integration|_test)$/.test(url.pathname)) throw new Error("Dedicated test database required");
    const department = await prisma.department.upsert({ where: { name: "Calendar lifecycle integration" }, update: {}, create: { name: "Calendar lifecycle integration", code: "CAL-LIFECYCLE" } });
    const token = randomUUID();
    const manager = await prisma.employee.create({ data: { firstName: "Calendar", lastName: "Manager", email: `calendar-manager-${token}@integration.test`, position: "Manager", departmentId: department.id } });
    const adminUser = await prisma.user.create({ data: { email: manager.email, name: "Calendar Manager", role: "ADMIN", password: "integration-only", employeeId: manager.id } });
    const employee = await prisma.employee.create({ data: { firstName: "Calendar", lastName: "Requester", email: `calendar-requester-${token}@integration.test`, position: "Employee", departmentId: department.id, managerId: manager.id } });
    const user = await prisma.user.create({ data: { email: employee.email, name: "Calendar Requester", password: "integration-only", employeeId: employee.id } });
    const latest = await prisma.holidayCalendar.findFirst({ where: { year: { gte: 9000 } }, orderBy: { year: "desc" } });
    const year = (latest?.year ?? 8999) + 1;
    if (year > 9998) throw new Error("Test year space exhausted");
    let date = { year, month: 5, day: 1 };
    while (getBusinessDayOfWeek(date) !== 1) date = addCalendarDays(date, 1);
    return {
        year, start: toDateOnlyString(date), middle: toDateOnlyString(addCalendarDays(date, 1)), end: toDateOnlyString(addCalendarDays(date, 2)),
        admin: { userId: adminUser.id, channel: "DASHBOARD" },
        owner: { userId: user.id, employeeId: employee.id, userEmail: user.email, authorization: buildLeaveAuthorizationContext(user, employee.id, "DASHBOARD") },
        approver: { userId: adminUser.id, employeeId: manager.id, userEmail: adminUser.email, name: "Manager", authorization: buildLeaveAuthorizationContext(adminUser, manager.id, "DASHBOARD") },
    };
}

export type CalendarFixture = Awaited<ReturnType<typeof createCalendarFixture>>;

export async function calendarDraft(f: CalendarFixture, days: HolidayDayInput[]): Promise<{ id: string; revision: number; active: number | null }> {
    const calendar = await prisma.holidayCalendar.findUnique({ where: { year: f.year } });
    const state = await mutateHolidayCalendar(f.admin, { action: "create", year: f.year, expectedActiveVersion: calendar?.activeVersionNumber ?? null });
    const draft = state.versions[0];
    const saved = await mutateHolidayCalendar(f.admin, { action: "save", year: f.year, versionId: draft.id, revision: 0, days });
    return { id: draft.id, revision: saved.versions[0].revision, active: state.activeVersionNumber };
}

export function publishInput(f: CalendarFixture, draft: { id: string; revision: number; active: number | null }): object {
    return { action: "publish", year: f.year, versionId: draft.id, revision: draft.revision, expectedActiveVersion: draft.active, verified: true, confirmEmpty: true, note: "Verified synthetic integration calendar, not actual holidays" };
}

export async function publishCalendar(f: CalendarFixture, days: HolidayDayInput[] = []): Promise<string> {
    const draft = await calendarDraft(f, days);
    await mutateHolidayCalendar(f.admin, publishInput(f, draft));
    return draft.id;
}

export function holiday(date: string): HolidayDayInput {
    return { date, name: "วันหยุดทดสอบเท่านั้น", category: "ORGANIZATION", source: "integration fixture, not reference data" };
}

export async function requestCalendarLeave(f: CalendarFixture, payload: Partial<Parameters<typeof createLeaveRequest>[0]["payload"]> = {}, key: string = randomUUID()): ReturnType<typeof createLeaveRequest> {
    return createLeaveRequest({ ...f.owner, id: randomUUID(), idempotencyKey: key, attachments: [], payload: { leaveType: "VACATION", startDate: f.start, endDate: f.end, period: "FULL_DAY", reason: "Calendar lifecycle integration", ...payload } });
}
