import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { IT_TICKET_STATUS_LABELS, IT_TICKET_TYPE_LABELS } from "../../contracts";
import { ITAnalyticsDashboard } from "./ITAnalyticsDashboard";

interface MockResponse {
    readonly ok: boolean;
    readonly status: number;
    json(): Promise<unknown>;
}

interface PendingRequest {
    readonly period: string;
    readonly signal: AbortSignal | null;
    readonly resolve: (response: MockResponse) => void;
}

function response(payload: unknown, status = 200): MockResponse {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => payload,
    };
}

function dashboardPayload(period: string, backlog: number): unknown {
    const now = "2026-09-25T17:05:00.000Z";
    return {
        success: true,
        dashboard: {
            generatedAt: now,
            timeZone: "Asia/Bangkok",
            period: {
                key: period,
                startAt: "2026-09-19T17:00:00.000Z",
                endAt: now,
            },
            summary: {
                currentBacklog: backlog,
                waitingRequester: 1,
                unassignedBacklog: 1,
                oldestUnresolvedAgeMinutes: 138,
                newTickets: backlog + 1,
                resolvedTickets: 2,
                firstRespondedTickets: 3,
                averageFirstResponseMinutes: 138,
                averageResolutionMinutes: null,
            },
            trend: [
                { date: "2026-09-25", created: backlog, resolved: 1 },
                { date: "2026-09-26", created: 1, resolved: 1 },
            ],
            statusDistribution: [
                { status: "OPEN", count: backlog },
                { status: "IN_PROGRESS", count: 0 },
                { status: "WAITING_REQUESTER", count: 1 },
                { status: "RESOLVED", count: 2 },
                { status: "CLOSED", count: 0 },
                { status: "CANCELLED", count: 0 },
            ],
            typeDistribution: [
                { type: "INCIDENT", count: 1 },
                { type: "SERVICE_REQUEST", count: 0 },
                { type: "SUGGESTION", count: 0 },
            ],
            categoryBacklog: [{ label: "ยังไม่จัดหมวดหมู่", count: backlog }],
            assigneeBacklog: [{ label: "ยังไม่มีผู้รับผิดชอบ", count: 1 }],
            departmentCreated: [{ label: "ไม่ระบุหน่วยงาน", count: 1 }],
        },
    };
}

async function choosePeriod(label: string): Promise<void> {
    fireEvent.keyDown(screen.getByRole("combobox", { name: "เลือกช่วงเวลารายงาน" }), {
        key: "Enter",
    });
    fireEvent.click(await screen.findByRole("option", { name: label }));
}

async function chooseBreakdown(label: string): Promise<void> {
    fireEvent.keyDown(screen.getByRole("combobox", { name: "เลือกมิติรายละเอียด" }), {
        key: "Enter",
    });
    fireEvent.click(await screen.findByRole("option", { name: label }));
}

describe("IT analytics Dashboard presentation", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        fetchMock.mockReset();
        Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
            configurable: true,
            value: vi.fn(),
        });
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("renders all summary values in a flat overview and the fixed Bangkok reporting window", async () => {
        fetchMock.mockResolvedValue(response(dashboardPayload("30D", 5)));

        render(<ITAnalyticsDashboard />);

        const overview = await screen.findByRole("region", { name: "ภาพรวม" });
        expect(within(overview).getByText("งานค้าง")).toBeInTheDocument();
        expect(within(overview).getByText("5", { selector: "dd" })).toBeInTheDocument();
        expect(within(overview).getByText("รอข้อมูลจากผู้แจ้ง")).toBeInTheDocument();
        expect(within(overview).getByText("ยังไม่มีผู้รับผิดชอบ")).toBeInTheDocument();
        expect(within(overview).getAllByText("1", { selector: "dd" })).toHaveLength(2);
        expect(within(overview).getByText("Ticket ใหม่")).toBeInTheDocument();
        expect(within(overview).getByText("6", { selector: "dd" })).toBeInTheDocument();
        expect(within(overview).getByText("แก้ไขแล้ว")).toBeInTheDocument();
        expect(within(overview).getByText("2", { selector: "dd" })).toBeInTheDocument();
        expect(within(overview).getByText("เวลาตอบกลับครั้งแรกเฉลี่ย")).toBeInTheDocument();
        expect(within(overview).getByText("2 ชม. 18 นาที")).toBeInTheDocument();
        expect(within(overview).getByText("จาก 3 Ticket ที่มีการตอบกลับ")).toBeInTheDocument();
        expect(within(overview).getByText("เวลาแก้ไขเฉลี่ย")).toBeInTheDocument();
        expect(within(overview).getByText("ยังไม่มีข้อมูล")).toBeInTheDocument();
        expect(within(overview).getByText("จาก 2 Ticket ที่มีการแก้ไข")).toBeInTheDocument();
        expect(within(overview).getByText("งานที่ค้างนานที่สุด 2 ชม. 18 นาที")).toBeInTheDocument();
        expect(screen.queryByRole("region", { name: "งานค้างปัจจุบัน" })).not.toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "รายงาน IT" })).toBeInTheDocument();
        expect(screen.getByText(/เวลาเอเชีย\/กรุงเทพฯ/)).toBeInTheDocument();
        const chartRegion = screen.getByRole("region", {
            name: "กราฟ Ticket ใหม่และแก้ไขแล้ว เลื่อนแนวนอนเพื่อดูข้อมูลทั้งหมด",
        });
        expect(chartRegion).toHaveAttribute("tabindex", "0");
        expect(within(chartRegion).getByRole("img", { name: /แนวโน้ม Ticket ใหม่และแก้ไขแล้วรายวัน/ }))
            .toBeInTheDocument();
        expect(screen.getByText("ดูตัวเลขรายวัน")).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledWith(
            "/api/it/analytics?period=30D",
            expect.objectContaining({ signal: expect.any(AbortSignal) }),
        );
    });

    it("shows one breakdown by default and makes all five datasets selectable", async () => {
        fetchMock.mockResolvedValue(response(dashboardPayload("30D", 5)));

        render(<ITAnalyticsDashboard />);

        const breakdown = await screen.findByRole("region", { name: "สถานะ Ticket ปัจจุบัน" });
        expect(within(breakdown).getByText(IT_TICKET_STATUS_LABELS.OPEN)).toBeInTheDocument();
        expect(screen.getByRole("combobox", { name: "เลือกมิติรายละเอียด" }))
            .toHaveTextContent("สถานะ");
        expect(screen.queryByRole("region", { name: "Ticket ใหม่แยกตามประเภท" }))
            .not.toBeInTheDocument();
        expect(screen.queryByRole("region", { name: "งานค้างแยกตามหมวดหมู่" }))
            .not.toBeInTheDocument();
        expect(screen.queryByRole("region", { name: "งานค้างแยกตามผู้รับผิดชอบ" }))
            .not.toBeInTheDocument();
        expect(screen.queryByRole("region", { name: "Ticket ใหม่แยกตามหน่วยงาน" }))
            .not.toBeInTheDocument();

        await chooseBreakdown("ประเภท");
        const typeBreakdown = screen.getByRole("region", { name: "Ticket ใหม่แยกตามประเภท" });
        expect(within(typeBreakdown).getByText(IT_TICKET_TYPE_LABELS.INCIDENT)).toBeInTheDocument();
        expect(within(typeBreakdown).queryByText(IT_TICKET_STATUS_LABELS.OPEN)).not.toBeInTheDocument();

        await chooseBreakdown("หมวดหมู่");
        expect(within(screen.getByRole("region", { name: "งานค้างแยกตามหมวดหมู่" }))
            .getByText("ยังไม่จัดหมวดหมู่")).toBeInTheDocument();

        await chooseBreakdown("ผู้รับผิดชอบ");
        expect(within(screen.getByRole("region", { name: "งานค้างแยกตามผู้รับผิดชอบ" }))
            .getByText("ยังไม่มีผู้รับผิดชอบ")).toBeInTheDocument();

        await chooseBreakdown("หน่วยงาน");
        expect(within(screen.getByRole("region", { name: "Ticket ใหม่แยกตามหน่วยงาน" }))
            .getByText("ไม่ระบุหน่วยงาน")).toBeInTheDocument();
    });

    it("shows zero data as a valid empty dashboard without displaying zero-minute averages", async () => {
        const empty = dashboardPayload("30D", 0) as {
            dashboard: Record<string, unknown>;
        };
        Object.assign(empty.dashboard, {
            summary: {
                currentBacklog: 0,
                waitingRequester: 0,
                unassignedBacklog: 0,
                oldestUnresolvedAgeMinutes: null,
                newTickets: 0,
                resolvedTickets: 0,
                firstRespondedTickets: 0,
                averageFirstResponseMinutes: null,
                averageResolutionMinutes: null,
            },
            trend: Array.from({ length: 30 }, (_, index) => ({
                date: `2026-09-${String(index + 1).padStart(2, "0")}`,
                created: 0,
                resolved: 0,
            })),
            statusDistribution: [
                { status: "OPEN", count: 0 },
                { status: "IN_PROGRESS", count: 0 },
                { status: "WAITING_REQUESTER", count: 0 },
                { status: "RESOLVED", count: 0 },
                { status: "CLOSED", count: 0 },
                { status: "CANCELLED", count: 0 },
            ],
            typeDistribution: [
                { type: "INCIDENT", count: 0 },
                { type: "SERVICE_REQUEST", count: 0 },
                { type: "SUGGESTION", count: 0 },
            ],
            categoryBacklog: [],
            assigneeBacklog: [],
            departmentCreated: [],
        });
        fetchMock.mockResolvedValue(response(empty));

        render(<ITAnalyticsDashboard />);

        expect(await screen.findByText("ยังไม่มีข้อมูลในช่วงเวลานี้")).toBeInTheDocument();
        expect(screen.getAllByText("ยังไม่มีข้อมูล").length).toBeGreaterThanOrEqual(2);
        expect(screen.getAllByText("0").length).toBeGreaterThan(0);
        expect(screen.queryByText("0 นาที")).not.toBeInTheDocument();

        await chooseBreakdown("หมวดหมู่");
        const emptyBreakdown = screen.getByRole("region", { name: "งานค้างแยกตามหมวดหมู่" });
        expect(within(emptyBreakdown).getByText("ยังไม่มีข้อมูลในช่วงเวลานี้")).toBeInTheDocument();
        expect(within(emptyBreakdown).queryByRole("meter")).not.toBeInTheDocument();
    });

    it("does not let an older period response overwrite the newest selection", async () => {
        fetchMock.mockResolvedValueOnce(response(dashboardPayload("30D", 30)));
        const pending: PendingRequest[] = [];
        fetchMock.mockImplementation((input: string | URL, init?: RequestInit) => {
            const period = new URL(String(input), "http://localhost")
                .searchParams.get("period") ?? "";
            return new Promise<MockResponse>((resolve) => {
                pending.push({
                    period,
                    signal: init?.signal instanceof AbortSignal ? init.signal : null,
                    resolve,
                });
            });
        });

        render(<ITAnalyticsDashboard />);
        await screen.findByRole("region", { name: "ภาพรวม" });

        await choosePeriod("7 วัน");
        await waitFor(() => expect(pending).toHaveLength(1));
        await choosePeriod("90 วัน");
        await waitFor(() => expect(pending).toHaveLength(2));
        expect(pending[0]?.period).toBe("7D");
        expect(pending[0]?.signal?.aborted).toBe(true);

        await act(async () => {
            pending[1]?.resolve(response(dashboardPayload("90D", 90)));
        });
        expect(await screen.findByRole("region", { name: "ภาพรวม" }))
            .toHaveTextContent("90");

        await act(async () => {
            pending[0]?.resolve(response(dashboardPayload("7D", 7)));
        });
        expect(screen.getByRole("region", { name: "ภาพรวม" }))
            .toHaveTextContent("90");
        expect(screen.getByRole("combobox", { name: "เลือกช่วงเวลารายงาน" }))
            .toHaveTextContent("90 วัน");
    });

    it("replaces stale data with a safe error and retries the selected period", async () => {
        fetchMock
            .mockRejectedValueOnce(new Error("private database connection details"))
            .mockResolvedValueOnce(response(dashboardPayload("30D", 4)));

        render(<ITAnalyticsDashboard />);

        expect(await screen.findByRole("alert")).toHaveTextContent("ขัดข้องชั่วคราว");
        expect(screen.queryByText("private database connection details")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "ลองอีกครั้ง" }));
        expect(await screen.findByRole("region", { name: "ภาพรวม" }))
            .toHaveTextContent("4");
    });
});
