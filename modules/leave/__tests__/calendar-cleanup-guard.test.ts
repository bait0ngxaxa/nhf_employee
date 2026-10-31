import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanCalendarFixtures } from "./integration/calendar-cleanup";

const mocks = vi.hoisted(() => ({
    users: vi.fn<() => Promise<{ id: number }[]>>(),
    employees: vi.fn<() => Promise<{ id: number }[]>>(),
    calendars: vi.fn<() => Promise<{ year: number }[]>>(),
    versions: vi.fn<() => Promise<{ id: string; createdById: number; publishedById: number | null }[]>>(),
    requestCount: vi.fn<() => Promise<number>>(),
    connection: vi.fn<() => Promise<never>>(),
}));
vi.mock("mysql2/promise", () => ({ default: { createConnection: mocks.connection } }));
vi.mock("@/lib/db/prisma", () => ({ prisma: {
    user: { findMany: mocks.users }, employee: { findMany: mocks.employees },
    holidayCalendar: { findMany: mocks.calendars }, holidayCalendarVersion: { findMany: mocks.versions },
    leaveRequest: { count: mocks.requestCount },
} }));

describe("disposable calendar fixture cleanup safety", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("NODE_ENV", "test");
        vi.stubEnv("DATABASE_URL", "mysql://fixture:fixture@localhost/calendar_test");
        mocks.users.mockResolvedValue([{ id: 1 }]);
        mocks.employees.mockResolvedValue([{ id: 2 }]);
        mocks.calendars.mockResolvedValue([{ year: 8000 }]);
        mocks.versions.mockResolvedValue([{ id: "fixture-version", createdById: 1, publishedById: 1 }]);
    });
    afterEach(() => vi.unstubAllEnvs());
    it("refuses production runtime and non-test database names before any database access", async () => {
        vi.stubEnv("NODE_ENV", "production");
        await expect(cleanCalendarFixtures()).rejects.toThrow("dedicated");
        vi.stubEnv("NODE_ENV", "test");
        vi.stubEnv("DATABASE_URL", "mysql://fixture:fixture@localhost/employee_nhf");
        await expect(cleanCalendarFixtures()).rejects.toThrow("dedicated");
        expect(mocks.users).not.toHaveBeenCalled();
        expect(mocks.connection).not.toHaveBeenCalled();
    });
    it("refuses real calendar years even inside a disposable database", async () => {
        mocks.calendars.mockResolvedValue([{ year: 2026 }]);
        await expect(cleanCalendarFixtures()).rejects.toThrow("not owned");
        expect(mocks.connection).not.toHaveBeenCalled();
    });
    it("refuses data referenced by another fixture before issuing destructive SQL", async () => {
        mocks.requestCount.mockResolvedValue(1);
        await expect(cleanCalendarFixtures()).rejects.toThrow("another fixture");
        expect(mocks.connection).not.toHaveBeenCalled();
    });
});
