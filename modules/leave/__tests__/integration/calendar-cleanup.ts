import mysql from "mysql2/promise";
import { prisma } from "@/lib/db/prisma";

/**
 * Test-only fixture disposal. TRUNCATE bypasses DELETE triggers without removing
 * them; production application commands have no equivalent escape hatch.
 * Existing integration suites globally delete Users/Employees, so these fixtures
 * must be disposed after each file rather than surviving into another suite.
 */
export async function cleanCalendarFixtures(): Promise<void> {
    return disposeCalendarFixtures(false);
}

/** Opt-in only for the actual bundled-year suite; normal fixtures still reject real years. */
export async function cleanCalendarDefaultFixtures(): Promise<void> {
    return disposeCalendarFixtures(true);
}

async function disposeCalendarFixtures(includeBuiltInDefaults: boolean): Promise<void> {
    const rawUrl = process.env.DATABASE_URL;
    const url = new URL(rawUrl ?? "");
    if (process.env.NODE_ENV !== "test" || !rawUrl || url.protocol !== "mysql:" || !/(?:_integration|_test)$/.test(url.pathname)) {
        throw new Error("Calendar cleanup requires a dedicated MySQL test database");
    }
    const users = await prisma.user.findMany({
        where: { email: { startsWith: "calendar-", endsWith: "@integration.test" } },
        select: { id: true },
    });
    const employees = await prisma.employee.findMany({
        where: { email: { startsWith: "calendar-", endsWith: "@integration.test" } },
        select: { id: true },
    });
    const userIds = users.map((row) => row.id);
    const employeeIds = employees.map((row) => row.id);
    const calendars = await prisma.holidayCalendar.findMany({ select: { year: true } });
    const versions = await prisma.holidayCalendarVersion.findMany({ select: { id: true, year: true, defaultDatasetRevision: true, createdById: true, publishedById: true } });
    const bundledYear = (year: number): boolean => includeBuiltInDefaults && [2026, 2027].includes(year);
    if (calendars.some((row) => !bundledYear(row.year) && (row.year < 8000 || row.year > 9998))
        || versions.some((row) => (row.createdById === null
            ? !bundledYear(row.year) || row.defaultDatasetRevision !== `bot-${row.year}-r1` || row.publishedById !== null
            : !userIds.includes(row.createdById)) || (row.publishedById !== null && !userIds.includes(row.publishedById)))) {
        throw new Error("Refusing cleanup: calendar data is not owned by synthetic calendar fixtures");
    }
    const externalReferences = await prisma.leaveRequest.count({
        where: {
            employeeId: { notIn: employeeIds },
            OR: [
                { calculationCalendarVersionId: { in: versions.map((row) => row.id) } },
                { approvalCalendarVersionId: { in: versions.map((row) => row.id) } },
                { calendarAdjustments: { some: {} } },
                { approverId: { in: employeeIds } },
                { exceptionApproverId: { in: employeeIds } },
            ],
        },
    });
    if (externalReferences > 0) throw new Error("Refusing cleanup: another fixture references calendar data");
    const requests = await prisma.leaveRequest.findMany({ where: { employeeId: { in: employeeIds } }, select: { id: true } });
    const requestIds = requests.map((row) => row.id);
    const connection = await mysql.createConnection(rawUrl);
    try {
        // A dedicated, unpooled test connection keeps FK_CHECKS isolated from Prisma.
        await connection.query("SET FOREIGN_KEY_CHECKS = 0");
        await connection.query("TRUNCATE TABLE leave_calendar_adjustments");
        await prisma.leaveRequest.deleteMany({ where: { id: { in: requestIds } } });
        await connection.query("TRUNCATE TABLE holiday_calendar_days");
        await connection.query("TRUNCATE TABLE holiday_calendar_versions");
        await connection.query("TRUNCATE TABLE holiday_calendars");
    } finally {
        await connection.end();
    }
    await prisma.notificationOutbox.deleteMany({ where: { OR: requestIds.map((id) => ({ payload: { contains: id } })) } });
    await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
    if (includeBuiltInDefaults) {
        await prisma.auditLog.deleteMany({ where: { userId: null, entityType: "HolidayCalendar", entityId: { in: [2026, 2027] }, action: "LEAVE_CALENDAR_PUBLISH" } });
    }
    await prisma.leaveQuota.deleteMany({ where: { employeeId: { in: employeeIds } } });
    await prisma.employee.updateMany({ where: { id: { in: employeeIds } }, data: { managerId: null } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.employee.deleteMany({ where: { id: { in: employeeIds } } });
    await prisma.department.deleteMany({ where: { name: { in: ["Calendar integration", "Calendar lifecycle integration"] }, employees: { none: {} } } });
}
