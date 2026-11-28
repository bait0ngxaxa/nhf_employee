import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { IT_TICKET_STATUS_LABELS, IT_TICKET_TYPE_LABELS } from "../../contracts";
import { getITAnalyticsPeriodBounds, isITAnalyticsPeriod } from "../../domain/analytics-period";
import { ITAnalyticsDashboard } from "./ITAnalyticsDashboard";
import { ITAnalyticsTrendChart } from "./ITAnalyticsTrendChart";

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
    const bounds = getITAnalyticsPeriodBounds(isITAnalyticsPeriod(period) ? period : "30D", new Date(now));
    return {
        success: true,
        dashboard: {
            generatedAt: now,
            timeZone: "Asia/Bangkok",
            period: {
                key: period,
                startAt: bounds.startAt.toISOString(),
                endAt: now,
            },
            previousPeriod: {
                startAt: bounds.previous.startAt.toISOString(),
                endAt: bounds.previous.endAt.toISOString(),
                newTickets: { count: 0, percentageChange: null },
                resolvedTickets: { count: 4, percentageChange: -50 },
            },
            filters: { type: null, category: null },
            filterOptions: { categories: [] },
            summary: {
                currentBacklog: backlog,
                waitingRequester: Math.min(backlog, 1),
                unassignedBacklog: 1,
                untriagedBacklog: 1,
                highPriorityBacklog: 2,
                agedBacklog: 0,
                oldestUnresolvedAgeMinutes: 138,
                newTickets: backlog + 1,
                resolvedTickets: 2,
                closedTickets: 1,
                cancelledTickets: 2,
                reopenedTickets: 3,
            },
            trend: [
                { date: "2026-09-25", created: backlog, resolved: 1 },
                { date: "2026-09-26", created: 1, resolved: 1 },
            ],
            statusDistribution: [
                { status: "OPEN", count: Math.max(backlog - 1, 0) },
                { status: "IN_PROGRESS", count: 0 },
                { status: "WAITING_REQUESTER", count: Math.min(backlog, 1) },
                { status: "RESOLVED", count: 2 },
                { status: "CLOSED", count: 0 },
                { status: "CANCELLED", count: 0 },
            ],
            typeDistribution: [
                { type: "INCIDENT", count: backlog + 1 },
                { type: "SERVICE_REQUEST", count: 0 },
                { type: "SUGGESTION", count: 0 },
            ],
            priorityDistribution: [
                { priority: "P0", count: 1 },
                { priority: "P1", count: 2 },
                { priority: "P2", count: backlog },
                { priority: "P3", count: 0 },
            ],
            priorityBacklog: [
                { priority: "P0", count: 1 },
                { priority: "P1", count: 1 },
                { priority: "P2", count: Math.max(backlog - 2, 0) },
                { priority: "P3", count: 0 },
            ],
            topCategories: {
                limit: 10,
                rows: [
                    { categoryId: 4, label: "อุปกรณ์คอมพิวเตอร์", count: 4 },
                    { categoryId: null, label: "ยังไม่จัดหมวดหมู่", count: 1 },
                ],
                otherCategoryCount: 1,
                otherTicketCount: 1,
            },
            backlogAging: [
                { bucket: "0_1", count: backlog },
                { bucket: "2_3", count: 0 },
                { bucket: "4_7", count: 0 },
                { bucket: "8_14", count: 0 },
                { bucket: "15_PLUS", count: 0 },
            ],
            categoryBacklog: [{ label: "ยังไม่จัดหมวดหมู่", count: backlog }],
            assigneeBacklog: [
                { label: "ยังไม่มีผู้รับผิดชอบ", count: Math.min(backlog, 1) },
                { label: "ผู้รับผิดชอบเดิม", count: Math.max(backlog - 1, 0) },
            ],
            departmentCreated: backlog === 5 ? [
                { label: "สำนักงานส่งเสริมระบบสุขภาพและการมีส่วนร่วมของชุมชน", count: 1 },
                ...Array.from({ length: 4 }, (_, index) => ({ label: `หน่วยงานเดิม ${index + 1}`, count: 1 })),
                { label: "ไม่ระบุหน่วยงาน", count: 1 },
            ] : [{ label: "ไม่ระบุหน่วยงาน", count: backlog + 1 }],
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
        vi.stubGlobal("ResizeObserver", class {
            constructor(private readonly callback: ResizeObserverCallback) {}
            observe(): void {
                this.callback([{ contentRect: { width: 1200, height: 320 } } as ResizeObserverEntry], this);
            }
            unobserve(): void {}
            disconnect(): void {}
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("renders the period and current snapshot KPIs with neutral comparisons", async () => {
        fetchMock.mockResolvedValue(response(dashboardPayload("30D", 5)));

        render(<ITAnalyticsDashboard />);

        const period = await screen.findByRole("region", { name: "ผลการดำเนินงานตามช่วงเวลา" });
        const metrics = (scope: HTMLElement): readonly string[] =>
            Array.from(scope.querySelectorAll("dl > div"), (row) => row.textContent);
        expect(metrics(period)).toEqual([
            "Ticket ใหม่6เพิ่มขึ้น 6 Ticket · ช่วงก่อนหน้า 0 Ticket",
            "แก้ไขแล้ว2ลดลง 50% · ช่วงก่อนหน้า 4 Ticket",
            "ปิดงานแล้ว1",
            "ยกเลิก2",
            "เปิดกลับมาแก้ไข3",
        ]);
        expect(period).toHaveTextContent("Ticket เดียวอาจอยู่หลายประเภท");
        expect(period).toHaveTextContent(/เปรียบเทียบกับช่วงก่อนหน้าที่มีระยะเวลาเท่ากัน/);

        const snapshot = screen.getByRole("region", { name: "สถานะงานปัจจุบัน" });
        expect(metrics(snapshot)).toEqual([
            "งานค้างทั้งหมด5งานที่ค้างนานที่สุด 2 ชม. 18 นาที",
            "กำลังดำเนินการ0",
            "รอข้อมูลจากผู้แจ้ง1",
            "งานเร่งด่วน P0 / P12P0 1 · P1 1",
        ]);
        expect(screen.queryByText("ตอบกลับครั้งแรกเฉลี่ย")).not.toBeInTheDocument();
        expect(screen.queryByText("เวลาแก้ไขเฉลี่ย")).not.toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "รายงานการให้บริการ IT" })).toBeInTheDocument();
        expect(screen.getByText(/เวลาเอเชีย\/กรุงเทพฯ/)).toBeInTheDocument();
        expect(screen.getByText(/สถานะล่าสุด ไม่ขึ้นกับช่วงเวลา/)).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledWith(
            "/api/it/analytics?period=30D",
            expect.objectContaining({ signal: expect.any(AbortSignal) }),
        );
    });

    it("orders period, demand, current workload, and additional breakdowns", async () => {
        fetchMock.mockResolvedValue(response(dashboardPayload("30D", 5)));

        render(<ITAnalyticsDashboard />);

        await screen.findByRole("region", { name: "สถานะงานปัจจุบัน" });
        const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
        expect(headings).toEqual([
            "ผลการดำเนินงานตามช่วงเวลา",
            "ปริมาณงานและแนวโน้ม",
            "สถานะงานปัจจุบัน",
            "สถานะ Ticket ปัจจุบัน",
        ]);
        const demand = screen.getByRole("region", { name: "ปริมาณงานและแนวโน้ม" });
        expect(within(demand).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
            "แนวโน้ม Ticket ใหม่และแก้ไขแล้ว",
            "หมวดปัญหาที่มีการแจ้งมากที่สุด",
            "Ticket ใหม่แยกตามหน่วยงาน",
            "Ticket ใหม่แยกตามประเภท",
        ]);
        const snapshot = screen.getByRole("region", { name: "สถานะงานปัจจุบัน" });
        expect(within(snapshot).getAllByRole("heading", { level: 3 }).map((heading) => heading.textContent)).toEqual([
            "งานค้างแยกตามสถานะ",
            "งานค้างตาม Priority",
            "สิ่งที่ต้องติดตาม",
            "อายุงานค้าง",
            "งานค้างตามผู้รับผิดชอบ",
        ]);
        const statuses = within(snapshot).getByRole("region", { name: "งานค้างแยกตามสถานะ" });
        expect(within(statuses).getAllByRole("listitem").map((row) => row.textContent)).toEqual([
            `${IT_TICKET_STATUS_LABELS.OPEN}4`,
            `${IT_TICKET_STATUS_LABELS.IN_PROGRESS}0`,
            `${IT_TICKET_STATUS_LABELS.WAITING_REQUESTER}1`,
        ]);

        const categories = screen.getByRole("region", { name: "หมวดปัญหาที่มีการแจ้งมากที่สุด" });
        const ranked = within(categories).getByRole("list", { name: "อันดับหมวดปัญหาและจำนวน Ticket" });
        expect(within(ranked).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
            expect.stringContaining("อุปกรณ์คอมพิวเตอร์"),
            expect.stringContaining("ยังไม่จัดหมวดหมู่"),
        ]);
        expect(ranked).toHaveTextContent("4 Ticket · 66.7%");
        expect(categories).toHaveTextContent("หมวดอื่นอีก 1 หมวด รวม 1 Ticket");

        const priority = screen.getByRole("region", { name: "งานค้างตาม Priority" });
        const priorityList = within(priority).getByRole("list", { name: "งานค้างแยกตาม Priority" });
        expect(priorityList).toHaveTextContent("P2 — ปกติ3");
        expect(priorityList).toHaveTextContent("60%");

        const aging = screen.getByRole("region", { name: "อายุงานค้าง" });
        expect(aging).toHaveTextContent("ไม่ใช่การวัด SLA");
        expect(within(aging).getByRole("region", { name: "กราฟอายุงานค้าง" }))
            .toHaveAccessibleDescription(/0–1 วัน 5 รายการ, 2–3 วัน 0 รายการ/);

        const attention = screen.getByRole("region", { name: "สิ่งที่ต้องติดตาม" });
        expect(within(attention).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
            expect.stringContaining("งานเร่งด่วน P0 / P1 ที่ยังไม่แก้ไข"),
            expect.stringContaining("ยังไม่มีผู้รับผิดชอบ"),
            expect.stringContaining("ยังไม่ประเมิน Priority"),
            expect.stringContaining("ค้างเกิน 7 วัน"),
        ]);

        const workload = screen.getByRole("region", { name: "งานค้างตามผู้รับผิดชอบ" });
        expect(workload).toHaveTextContent("ไม่ใช่ตัวชี้วัดผลการทำงาน");
        expect(within(workload).getByRole("meter", { name: "ยังไม่มีผู้รับผิดชอบ 1 รายการ" })).toBeInTheDocument();

        expect(screen.queryByRole("region", { name: "ประสิทธิภาพการให้บริการ" })).not.toBeInTheDocument();
    });

    it("never renders Ticket links for analytics-only viewers", async () => {
        fetchMock.mockResolvedValue(response(dashboardPayload("30D", 5)));

        render(<ITAnalyticsDashboard />);

        await screen.findByRole("region", { name: "สถานะงานปัจจุบัน" });
        expect(screen.queryAllByRole("link")).toEqual([]);
    });

    it("keeps the remaining breakdowns selectable with their own data scope", async () => {
        fetchMock.mockResolvedValue(response(dashboardPayload("30D", 5)));

        render(<ITAnalyticsDashboard />);

        const breakdown = await screen.findByRole("region", { name: "สถานะ Ticket ปัจจุบัน" });
        expect(within(breakdown).getByText(IT_TICKET_STATUS_LABELS.OPEN)).toBeInTheDocument();
        expect(breakdown).toHaveTextContent("ข้อมูล ณ ปัจจุบัน");

        const typeBreakdown = screen.getByRole("region", { name: "Ticket ใหม่แยกตามประเภท" });
        expect(within(typeBreakdown).getByText(IT_TICKET_TYPE_LABELS.INCIDENT)).toBeInTheDocument();
        expect(typeBreakdown).toHaveTextContent("ตามช่วงรายงาน");

        await chooseBreakdown("Priority");
        expect(screen.getByRole("region", { name: "Ticket ปัจจุบันแยกตาม Priority" }))
            .toHaveTextContent("P0 — วิกฤต");

        await chooseBreakdown("หมวดหมู่งานค้าง");
        expect(within(screen.getByRole("region", { name: "งานค้างแยกตามหมวดหมู่" }))
            .getByText("ยังไม่จัดหมวดหมู่")).toBeInTheDocument();
    });

    it("shows the full department snapshot and its share of filtered new Tickets", async () => {
        fetchMock.mockResolvedValue(response(dashboardPayload("30D", 5)));
        render(<ITAnalyticsDashboard />);

        const departments = await screen.findByRole("region", { name: "Ticket ใหม่แยกตามหน่วยงาน" });
        const list = within(departments).getByRole("region", { name: "รายการหน่วยงานทั้งหมด" });
        expect(list).toHaveAttribute("tabindex", "0");
        expect(within(list).getAllByRole("listitem")).toHaveLength(6);
        expect(within(list).getByText("สำนักงานส่งเสริมระบบสุขภาพและการมีส่วนร่วมของชุมชน")).toBeInTheDocument();
        expect(within(list).getByText("ไม่ระบุหน่วยงาน").closest("li")).toHaveTextContent("1 Ticket · 16.7%");
    });

    it("shows zero data as valid empty states", async () => {
        const empty = dashboardPayload("30D", 0) as {
            dashboard: Record<string, unknown>;
        };
        Object.assign(empty.dashboard, {
            summary: {
                currentBacklog: 0,
                waitingRequester: 0,
                unassignedBacklog: 0,
                untriagedBacklog: 0,
                highPriorityBacklog: 0,
                agedBacklog: 0,
                oldestUnresolvedAgeMinutes: null,
                newTickets: 0,
                resolvedTickets: 0,
                closedTickets: 0,
                cancelledTickets: 0,
                reopenedTickets: 0,
            },
            previousPeriod: {
                startAt: "2026-07-29T16:55:00.000Z",
                endAt: "2026-08-27T17:00:00.000Z",
                newTickets: { count: 0, percentageChange: 0 },
                resolvedTickets: { count: 0, percentageChange: 0 },
            },
            trend: Array.from({ length: 30 }, (_, index) => ({
                date: `2026-09-${String(index + 1).padStart(2, "0")}`,
                created: 0,
                resolved: 0,
            })),
            priorityBacklog: [
                { priority: "P0", count: 0 },
                { priority: "P1", count: 0 },
                { priority: "P2", count: 0 },
                { priority: "P3", count: 0 },
            ],
            topCategories: { limit: 10, rows: [], otherCategoryCount: 0, otherTicketCount: 0 },
            categoryBacklog: [],
            assigneeBacklog: [],
            departmentCreated: [],
        });
        fetchMock.mockResolvedValue(response(empty));

        render(<ITAnalyticsDashboard />);

        const overview = await screen.findByRole("region", { name: "สถานะงานปัจจุบัน" });
        expect(within(overview).getByText("ไม่มีงานค้าง")).toBeInTheDocument();
        expect(screen.queryByText("0 นาที")).not.toBeInTheDocument();
        expect(within(screen.getByRole("region", { name: "หมวดปัญหาที่มีการแจ้งมากที่สุด" }))
            .getByRole("status")).toHaveTextContent("ยังไม่มี Ticket ที่สร้างในช่วงเวลานี้");
        expect(screen.queryByRole("list", { name: "อันดับหมวดปัญหาและจำนวน Ticket" })).not.toBeInTheDocument();
        for (const name of ["งานค้างตาม Priority", "อายุงานค้าง", "งานค้างตามผู้รับผิดชอบ"]) {
            expect(within(screen.getByRole("region", { name })).getByRole("status"))
                .toHaveTextContent("ไม่มีงานค้างในขณะนี้");
        }
        expect(within(screen.getByRole("region", { name: "สิ่งที่ต้องติดตาม" })).getAllByText("ไม่มีรายการ"))
            .toHaveLength(4);
        expect(screen.getByText("ยังไม่มีข้อมูลในช่วงเวลานี้")).toBeInTheDocument();
        expect(within(screen.getByRole("region", { name: "Ticket ใหม่แยกตามหน่วยงาน" }))
            .getByRole("status")).toHaveTextContent("ยังไม่มีข้อมูลตามตัวกรองที่เลือก");
    });

    it("requests type and category filters, explains their scope, and resets to the default report", async () => {
        fetchMock.mockImplementation(async (input: string | URL) => {
            const query = new URL(String(input), "http://localhost").searchParams;
            const payload = dashboardPayload(query.get("period") ?? "30D", 5) as { dashboard: Record<string, unknown> };
            payload.dashboard.filters = {
                type: query.get("type"),
                category: query.get("category") === "uncategorized"
                    ? "uncategorized"
                    : query.get("category") === null ? null : Number(query.get("category")),
            };
            payload.dashboard.filterOptions = {
                categories: [
                    { id: 4, key: "HARDWARE", name: "อุปกรณ์คอมพิวเตอร์", isActive: true },
                    { id: 9, key: "LEGACY", name: "หมวดเดิม", isActive: false },
                ],
            };
            return response(payload);
        });

        render(<ITAnalyticsDashboard />);
        await screen.findByRole("region", { name: "สถานะงานปัจจุบัน" });
        expect(screen.getByRole("button", { name: "ล้างตัวกรอง" })).toBeDisabled();

        fireEvent.keyDown(screen.getByRole("combobox", { name: "กรองตามประเภท Ticket" }), { key: "Enter" });
        fireEvent.click(await screen.findByRole("option", { name: IT_TICKET_TYPE_LABELS.INCIDENT }));
        await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(
            "/api/it/analytics?period=30D&type=INCIDENT",
            expect.anything(),
        ));

        fireEvent.keyDown(screen.getByRole("combobox", { name: "กรองตามหมวดหมู่" }), { key: "Enter" });
        expect(await screen.findByRole("option", { name: "หมวดเดิม · ปิดใช้งาน" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("option", { name: "ยังไม่จัดหมวดหมู่" }));
        await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(
            "/api/it/analytics?period=30D&type=INCIDENT&category=uncategorized",
            expect.anything(),
        ));
        expect(await screen.findByRole("note")).toHaveTextContent(
            "กำลังกรอง: ประเภท ปัญหาที่พบ · หมวดหมู่ ยังไม่จัดหมวดหมู่",
        );
        expect(screen.getByRole("note")).toHaveTextContent("ทั้งข้อมูลตามช่วงรายงานและข้อมูล ณ ปัจจุบัน");

        fireEvent.click(screen.getByRole("button", { name: "ล้างตัวกรอง" }));
        await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(
            "/api/it/analytics?period=30D",
            expect.anything(),
        ));
        expect(screen.queryByRole("note")).not.toBeInTheDocument();
    });

    it("filters historical categories for analytics-only viewers, preserving period/type and never requesting Tickets", async () => {
        fetchMock.mockResolvedValue(response(dashboardPayload("90D", 5)));
        const onChange = vi.fn();
        const { rerender } = render(<ITAnalyticsDashboard
            reportState={{ period: "90D", type: "INCIDENT", category: null }}
            onReportStateChange={onChange}
        />);
        await screen.findByRole("region", { name: "สถานะงานปัจจุบัน" });
        fireEvent.click(screen.getByRole("button", { name: "กรองรายงานตามหมวด อุปกรณ์คอมพิวเตอร์" }));
        expect(onChange).toHaveBeenLastCalledWith({ period: "90D", type: "INCIDENT", category: 4 });
        rerender(<ITAnalyticsDashboard reportState={{ period: "90D", type: "INCIDENT", category: 4 }} onReportStateChange={onChange} />);
        await screen.findByRole("region", { name: "สถานะงานปัจจุบัน" });
        fireEvent.click(screen.getByRole("button", { name: "กรองรายงานตามหมวด ยังไม่จัดหมวดหมู่" }));
        expect(onChange).toHaveBeenLastCalledWith({ period: "90D", type: "INCIDENT", category: "uncategorized" });
        fireEvent.keyDown(screen.getByRole("combobox", { name: "กรองตามหมวดหมู่" }), { key: "Enter" });
        fireEvent.click(await screen.findByRole("option", { name: "ทุกหมวดหมู่" }));
        expect(onChange).toHaveBeenLastCalledWith({ period: "90D", type: "INCIDENT", category: null });
        expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
            "/api/it/analytics?period=90D&type=INCIDENT",
            "/api/it/analytics?period=90D&type=INCIDENT&category=4",
        ]);
        expect(screen.queryByRole("link")).not.toBeInTheDocument();
    });

    it("delegates filter changes to a controlling URL owner instead of keeping local state", async () => {
        fetchMock.mockResolvedValue(response(dashboardPayload("7D", 5)));
        const onChange = vi.fn();

        render(<ITAnalyticsDashboard
            reportState={{ period: "7D", type: "SUGGESTION", category: 4 }}
            onReportStateChange={onChange}
        />);

        await screen.findByRole("region", { name: "สถานะงานปัจจุบัน" });
        expect(fetchMock).toHaveBeenCalledWith(
            "/api/it/analytics?period=7D&type=SUGGESTION&category=4",
            expect.anything(),
        );
        await choosePeriod("90 วัน");
        expect(onChange).toHaveBeenCalledWith({ period: "90D", type: "SUGGESTION", category: 4 });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("links aggregate rows to the operator queue only for viewers who can open it", async () => {
        const payload = dashboardPayload("30D", 5) as { dashboard: Record<string, unknown> };
        payload.dashboard.filters = { type: "INCIDENT", category: null };
        fetchMock.mockResolvedValue(response(payload));

        render(<ITAnalyticsDashboard canOpenOperatorQueue />);

        const categories = await screen.findByRole("region", { name: "หมวดปัญหาที่มีการแจ้งมากที่สุด" });
        expect(within(categories).queryByRole("link")).not.toBeInTheDocument();
        expect(within(categories).getByRole("button", { name: "กรองรายงานตามหมวด อุปกรณ์คอมพิวเตอร์" })).toBeInTheDocument();
        const attention = screen.getByRole("region", { name: "สิ่งที่ต้องติดตาม" });
        expect(within(attention).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
            "/dashboard/it?itTab=queue&queueStatus=ACTIVE&queueType=INCIDENT&queuePriority=P0",
            "/dashboard/it?itTab=queue&queueStatus=ACTIVE&queueType=INCIDENT&queuePriority=P1",
            "/dashboard/it?itTab=queue&queueStatus=ACTIVE&queueType=INCIDENT&queueAssignment=UNASSIGNED",
            "/dashboard/it?itTab=queue&queueStatus=ACTIVE&queueType=INCIDENT&queueTriage=UNTRIAGED",
        ]);
        expect(within(attention).getByText("ค้างเกิน 7 วัน").closest("li")?.querySelector("a")).toBeNull();
        expect(within(screen.getByRole("region", { name: "งานค้างตาม Priority" }))
            .queryByRole("link", { name: "P3 — ต่ำ" })).not.toBeInTheDocument();
        expect(within(screen.getByRole("region", { name: "งานค้างตามผู้รับผิดชอบ" }))
            .getByRole("link", { name: "ยังไม่มีผู้รับผิดชอบ" })).toHaveAttribute(
            "href",
            "/dashboard/it?itTab=queue&queueStatus=ACTIVE&queueType=INCIDENT&queueAssignment=UNASSIGNED",
        );
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
        await screen.findByRole("region", { name: "สถานะงานปัจจุบัน" });

        await choosePeriod("7 วัน");
        expect(screen.getByRole("status", { name: "กำลังโหลดรายงาน IT" })).toBeInTheDocument();
        expect(screen.queryByRole("application")).not.toBeInTheDocument();
        await waitFor(() => expect(pending).toHaveLength(1));
        await choosePeriod("90 วัน");
        await waitFor(() => expect(pending).toHaveLength(2));
        expect(pending[0]?.period).toBe("7D");
        expect(pending[0]?.signal?.aborted).toBe(true);

        await act(async () => {
            pending[1]?.resolve(response(dashboardPayload("90D", 90)));
        });
        expect(await screen.findByRole("region", { name: "สถานะงานปัจจุบัน" }))
            .toHaveTextContent("90");
        expect(screen.getByRole("application", { name: /รายสัปดาห์/ })).toBeInTheDocument();
        expect(screen.getByText(/เปรียบเทียบรายสัปดาห์ เริ่มวันจันทร์/)).toBeInTheDocument();
        fireEvent.click(screen.getByText("ดูตัวเลขรายวัน"));
        expect(screen.getByText("25 กันยายน 2569", { selector: "time" })).toBeVisible();
        expect(screen.getByText("26 กันยายน 2569", { selector: "time" })).toBeVisible();

        await act(async () => {
            pending[0]?.resolve(response(dashboardPayload("7D", 7)));
        });
        expect(screen.getByRole("region", { name: "สถานะงานปัจจุบัน" }))
            .toHaveTextContent("90");
        expect(screen.getByRole("combobox", { name: "เลือกช่วงเวลารายงาน" }))
            .toHaveTextContent("90 วัน");
    });

    it("refreshes the selected filters and announces loading before showing the updated report", async () => {
        fetchMock.mockResolvedValueOnce(response(dashboardPayload("7D", 4)));
        let resolveUpdated: ((result: MockResponse) => void) | undefined;
        fetchMock.mockImplementationOnce(() => new Promise<MockResponse>((resolve) => {
            resolveUpdated = resolve;
        }));
        render(<ITAnalyticsDashboard reportState={{ period: "7D", type: "INCIDENT", category: 4 }} />);
        await screen.findByRole("region", { name: "สถานะงานปัจจุบัน" });

        fireEvent.click(screen.getByRole("button", { name: "อัปเดตรายงาน" }));
        expect(screen.getByRole("button", { name: "อัปเดตรายงาน" })).toBeDisabled();
        expect(screen.getByRole("status", { name: "กำลังโหลดรายงาน IT" })).toBeInTheDocument();
        expect(fetchMock).toHaveBeenLastCalledWith(
            "/api/it/analytics?period=7D&type=INCIDENT&category=4",
            expect.objectContaining({ cache: "no-store" }),
        );
        await act(async () => resolveUpdated?.(response(dashboardPayload("7D", 9))));
        expect(await screen.findByRole("region", { name: "สถานะงานปัจจุบัน" })).toHaveTextContent("งานค้างทั้งหมด9");
        expect(screen.getByRole("button", { name: "อัปเดตรายงาน" })).toBeEnabled();
    });

    it("replaces stale data with a safe error and retries the selected period", async () => {
        fetchMock
            .mockRejectedValueOnce(new Error("private database connection details"))
            .mockResolvedValueOnce(response(dashboardPayload("30D", 4)));

        render(<ITAnalyticsDashboard />);

        expect(await screen.findByRole("alert")).toHaveTextContent("ขัดข้องชั่วคราว");
        expect(screen.queryByText("private database connection details")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "ลองอีกครั้ง" }));
        expect(await screen.findByRole("region", { name: "สถานะงานปัจจุบัน" }))
            .toHaveTextContent("4");
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock).toHaveBeenLastCalledWith("/api/it/analytics?period=30D", expect.anything());
    });

    it("renders an empty source without a broken chart and retains the daily disclosure", () => {
        render(<ITAnalyticsTrendChart trend={[]} period="90D" />);
        expect(screen.getByRole("status")).toHaveTextContent("ยังไม่มีข้อมูลในช่วงเวลานี้");
        expect(screen.queryByRole("application")).not.toBeInTheDocument();
        expect(screen.getByText("ดูตัวเลขรายวัน")).toBeInTheDocument();
        expect(screen.getByRole("list", { name: "คำอธิบายกราฟ" })).toHaveTextContent("Ticket ใหม่ 0แก้ไขแล้ว 0");
    });

    it.each(["7D", "30D", "90D"] as const)("exposes both series and full dates through keyboard tooltips for %s", async (period) => {
        render(<ITAnalyticsTrendChart period={period} trend={[
            { date: "2026-10-12", created: 1000, resolved: 0 },
            { date: "2026-10-13", created: 2, resolved: 6 },
        ]} />);
        const chart = screen.getByRole("application");
        fireEvent.focus(chart);
        const tooltip = await screen.findByRole("tooltip");
        expect(within(screen.getByRole("region", { name: "ตัวเลขช่วงที่เลือก" })).getByRole("tooltip"))
            .toBe(tooltip);
        expect(tooltip).toHaveTextContent(period === "90D" ? "12 ตุลาคม 2569 – 13 ตุลาคม 2569" : "12 ตุลาคม 2569");
        expect(tooltip).toHaveTextContent("Ticket ใหม่");
        expect(tooltip).toHaveTextContent("แก้ไขแล้ว");
        expect(tooltip).toHaveTextContent(period === "90D" ? "1,002" : "1,000");
        expect(tooltip).toHaveTextContent(period === "90D" ? "6" : "0");
        if (period !== "90D") {
            fireEvent.keyDown(chart, { key: "ArrowRight" });
            await waitFor(() => expect(tooltip).toHaveTextContent("13 ตุลาคม 2569"));
            expect(tooltip).toHaveTextContent("6");
        }
    });

    it("keeps all 90 original daily records available below the weekly chart", () => {
        const trend = Array.from({ length: 90 }, (_, index) => ({
            date: new Date(Date.UTC(2026, 7, 1 + index)).toISOString().slice(0, 10),
            created: index,
            resolved: index % 5,
        }));
        render(<ITAnalyticsTrendChart trend={trend} period="90D" />);
        fireEvent.click(screen.getByText("ดูตัวเลขรายวัน"));
        const details = screen.getByText("ดูตัวเลขรายวัน").closest("details");
        expect(details).not.toBeNull();
        const records = within(details as HTMLDetailsElement).getAllByRole("listitem");
        expect(records).toHaveLength(90);
        for (const [index, record] of records.entries()) {
            expect(record.querySelector("time")).toHaveAttribute("datetime", trend[index]?.date);
            expect(record).toHaveTextContent(`ใหม่ ${index}`);
            expect(record).toHaveTextContent(`แก้ไข ${index % 5}`);
        }
    });
});
