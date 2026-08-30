import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RoutineTaskForm } from "@/components/dashboard/routine/RoutineTaskForm";
import {
    daysInMonth,
    getCurrentBangkokDate,
    getDefaultRoutineScheduleConfig,
} from "@/lib/routine/schedule";
import type { RoutineTask } from "@/components/dashboard/routine/types";

describe("RoutineTaskForm reminder rules", () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("fetch", fetchMock);
        fetchMock.mockResolvedValue(
            new Response(JSON.stringify({ task: { id: 1 } }), { status: 201 }),
        );
    });

    it("uses the shared Bangkok-date defaults when switching schedule types", () => {
        render(
            <RoutineTaskForm
                reference={{
                    units: [{ id: 1, code: "มสช.", name: "มสช." }],
                    categories: [{ id: 1, name: "ระบบคอมพิวเตอร์", sortOrder: 1 }],
                    employees: [],
                }}
                initialTask={null}
                onSaved={vi.fn()}
                onCancel={vi.fn()}
            />,
        );

        const today = getCurrentBangkokDate();
        fireEvent.change(screen.getByLabelText("รูปแบบการเกิดงาน"), {
            target: { value: "INTERVAL_MONTHS" },
        });
        expect(screen.getByLabelText("วันที่เริ่มนับรอบ")).toHaveValue(
            String(getDefaultRoutineScheduleConfig("INTERVAL_MONTHS", today).anchorDate),
        );

        fireEvent.change(screen.getByLabelText("รูปแบบการเกิดงาน"), {
            target: { value: "ONE_TIME" },
        });
        expect(screen.getByLabelText("วันที่ครบกำหนด")).toHaveValue(
            String(getDefaultRoutineScheduleConfig("ONE_TIME", today).date),
        );
    });

    it("does not offer the manual schedule when creating a Routine", () => {
        render(
            <RoutineTaskForm
                reference={{ units: [], categories: [], employees: [] }}
                initialTask={null}
                onSaved={vi.fn()}
                onCancel={vi.fn()}
            />,
        );

        expect(screen.queryByRole("option", { name: "สร้างเอง" })).not.toBeInTheDocument();
    });

    it("keeps an existing manual Routine editable", () => {
        const manualTask = {
            id: 81,
            unitId: 1,
            categoryId: 1,
            title: "งานเดิมแบบสร้างเอง",
            description: null,
            scheduleType: "MANUAL",
            scheduleConfig: {},
            scheduleText: null,
            contractStartDate: null,
            contractEndDate: null,
            contractText: null,
            extraDetails: null,
            businessDayPolicy: "NONE",
            isActive: true,
            version: 1,
            sourceFileName: null,
            sourceSheet: null,
            sourceRow: null,
            createdById: 99,
            updatedById: 99,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-08-01T00:00:00.000Z",
            unit: { id: 1, code: "มสช.", name: "มสช.", isActive: true },
            category: { id: 1, name: "ระบบคอมพิวเตอร์", sortOrder: 1, isActive: true },
            assignees: [],
            reminderRules: [],
            _count: { occurrences: 0 },
        } satisfies RoutineTask;

        render(
            <RoutineTaskForm
                reference={{
                    units: [{ id: 1, code: "มสช.", name: "มสช." }],
                    categories: [{ id: 1, name: "ระบบคอมพิวเตอร์", sortOrder: 1 }],
                    employees: [],
                }}
                initialTask={manualTask}
                onSaved={vi.fn()}
                onCancel={vi.fn()}
            />,
        );

        expect(screen.getByLabelText("รูปแบบการเกิดงาน")).toHaveValue("MANUAL");
        expect(screen.getByRole("option", { name: "สร้างเอง" })).toBeInTheDocument();
        expect(screen.getByText("งานแบบสร้างเองจะไม่สร้างงานแต่ละรอบโดยอัตโนมัติ")).toBeInTheDocument();
    });

    it("cancels a pristine form without opening a confirmation", () => {
        const onCancel = vi.fn();
        render(
            <RoutineTaskForm
                reference={{
                    units: [],
                    categories: [],
                    employees: [],
                }}
                initialTask={null}
                onSaved={vi.fn()}
                onCancel={onCancel}
            />,
        );

        fireEvent.click(screen.getByRole("button", { name: "ยกเลิก" }));

        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(screen.queryByText("มีข้อมูลที่ยังไม่ได้บันทึก")).not.toBeInTheDocument();
    });

    it("protects dirty form data and keeps it when returning to edit", () => {
        const onCancel = vi.fn();
        render(
            <RoutineTaskForm
                reference={{
                    units: [],
                    categories: [],
                    employees: [],
                }}
                initialTask={null}
                onSaved={vi.fn()}
                onCancel={onCancel}
            />,
        );

        const title = screen.getByPlaceholderText("เช่น ตรวจสอบค่าใช้จ่ายประจำเดือน");
        fireEvent.change(title, { target: { value: "งานที่กำลังแก้" } });
        fireEvent.click(screen.getByRole("button", { name: "ยกเลิก" }));

        expect(screen.getByText("มีข้อมูลที่ยังไม่ได้บันทึก")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "กลับไปแก้ไข" }));
        expect(onCancel).not.toHaveBeenCalled();
        expect(title).toHaveValue("งานที่กำลังแก้");

        fireEvent.click(screen.getByRole("button", { name: "ยกเลิก" }));
        fireEvent.click(screen.getByRole("button", { name: "ออกโดยไม่บันทึก" }));
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("keeps day and month inputs within their valid calendar bounds", () => {
        render(
            <RoutineTaskForm
                reference={{
                    units: [{ id: 1, code: "มสช.", name: "มสช." }],
                    categories: [{ id: 1, name: "ระบบคอมพิวเตอร์", sortOrder: 1 }],
                    employees: [],
                }}
                initialTask={null}
                onSaved={vi.fn()}
                onCancel={vi.fn()}
            />,
        );

        const monthlyDay = screen.getByLabelText("วันที่ของเดือน");
        fireEvent.change(monthlyDay, { target: { value: "45" } });
        expect(monthlyDay).toHaveValue(31);

        fireEvent.change(screen.getByLabelText("รูปแบบการเกิดงาน"), {
            target: { value: "YEARLY_DATE" },
        });
        const month = screen.getByLabelText("เดือน");
        fireEvent.change(month, { target: { value: "15" } });
        expect(month).toHaveValue(12);

        fireEvent.change(month, { target: { value: "2" } });
        expect(screen.getByLabelText("วันที่")).toHaveValue(
            Math.min(
                Number(getCurrentBangkokDate().slice(-2)),
                daysInMonth(2024, 2),
            ),
        );
    });

    it("brings the first inline error into view after submit", async () => {
        const scrollIntoView = vi.fn();
        Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
            configurable: true,
            value: scrollIntoView,
        });

        render(
            <RoutineTaskForm
                reference={{
                    units: [{ id: 1, code: "มสช.", name: "มสช." }],
                    categories: [{ id: 1, name: "ระบบคอมพิวเตอร์", sortOrder: 1 }],
                    employees: [{
                        id: 11,
                        firstName: "สมชาย",
                        lastName: "ใจดี",
                        nickname: null,
                    }],
                }}
                initialTask={null}
                mode="SELF_SERVICE"
                onSaved={vi.fn()}
                onCancel={vi.fn()}
            />,
        );

        fireEvent.click(screen.getByRole("button", { name: "บันทึกงานของฉัน" }));

        const unitField = screen.getByDisplayValue("เลือกหน่วยงาน");
        await waitFor(() => expect(unitField).toHaveFocus());
        expect(scrollIntoView).toHaveBeenCalledWith({
            behavior: "smooth",
            block: "center",
        });
    });

    it("adds a preset and submits the reminder rules with the task", async () => {
        const onSaved = vi.fn();

        render(
            <RoutineTaskForm
                reference={{
                    units: [
                        { id: 1, code: "มสช.", name: "มสช." },
                        { id: 2, code: "มสช.", name: "มสช." },
                    ],
                    categories: [{ id: 1, name: "ระบบคอมพิวเตอร์", sortOrder: 1 }],
                    employees: [{
                        id: 11,
                        firstName: "สมชาย",
                        lastName: "ใจดี",
                        nickname: null,
                    }],
                }}
                initialTask={null}
                onSaved={onSaved}
                onCancel={vi.fn()}
            />,
        );

        expect(screen.queryByText("Schedule config (JSON)")).not.toBeInTheDocument();
        expect(screen.getByText("วันที่ของเดือน")).toBeInTheDocument();
        expect(screen.queryByText("เดือนที่เลื่อนจากรอบปกติ")).not.toBeInTheDocument();
        expect(screen.getByText("ช่วงสัญญา")).toBeInTheDocument();
        expect(screen.getByText(
            "เมื่อระบุวันสิ้นสุดสัญญา ระบบจะแจ้งผู้รับผิดชอบอัตโนมัติล่วงหน้า 1 เดือนตามปฏิทิน",
        )).toBeInTheDocument();
        expect(screen.getAllByRole("option", { name: "มสช." })).toHaveLength(1);
        expect(screen.getByRole("option", { name: "เลือกรูปแบบการแจ้งเตือน" })).toBeInTheDocument();
        expect(screen.getByLabelText("เลือกชุดกฎการแจ้งเตือน")).toHaveValue("");
        expect(screen.queryByRole("option", {
            name: "งานต่อสัญญา: 30, 7 และ 1 วัน",
        })).not.toBeInTheDocument();

        fireEvent.change(screen.getByDisplayValue("เลือกหน่วยงาน"), {
            target: { value: "1" },
        });
        fireEvent.change(screen.getByDisplayValue("เลือกหมวดหมู่"), {
            target: { value: "1" },
        });
        fireEvent.change(screen.getByPlaceholderText("เช่น ตรวจสอบค่าใช้จ่ายประจำเดือน"), {
            target: { value: "ตรวจสอบระบบ" },
        });
        fireEvent.change(screen.getByLabelText("ค้นหาพนักงาน"), {
            target: { value: "สมชาย" },
        });
        fireEvent.click(screen.getByRole("option", { name: "เพิ่ม สมชาย ใจดี เป็นผู้รับผิดชอบ" }));
        fireEvent.change(screen.getByLabelText("เลือกชุดกฎการแจ้งเตือน"), {
            target: { value: "monthly" },
        });

        expect(screen.getByLabelText("เลือกชุดกฎการแจ้งเตือน")).toHaveValue("monthly");
        expect(screen.getAllByDisplayValue("09:00")).toHaveLength(2);
        const reminderTimeFields = screen.getAllByLabelText("เวลาแจ้งเตือน (เวลาไทย)");
        expect(reminderTimeFields).toHaveLength(2);
        expect(reminderTimeFields[0]).toHaveValue("09:00");
        expect(reminderTimeFields[0]?.querySelectorAll("option")).toHaveLength(24);
        expect(screen.queryByRole("option", { name: "09:30" })).not.toBeInTheDocument();
        const firstReminderTime = reminderTimeFields[0];
        if (!firstReminderTime) throw new Error("Expected a reminder time field");
        fireEvent.change(firstReminderTime, { target: { value: "14:00" } });

        fireEvent.click(screen.getByRole("button", { name: "บันทึกแม่แบบงาน" }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
        const body = JSON.parse(String(request.body)) as {
            reminderRules: Array<{ daysBefore: number; sendHour: number; channel: string }>;
        };

        expect(body.reminderRules).toEqual([
            { daysBefore: 3, sendHour: 14, channel: "IN_APP", recipientScope: "ASSIGNEES", isActive: true },
            { daysBefore: 1, sendHour: 9, channel: "IN_APP", recipientScope: "ASSIGNEES", isActive: true },
        ]);
        expect(onSaved).toHaveBeenCalledTimes(1);
    });

    it("does not send a second create request during a double submit", async () => {
        let resolveFetch: ((response: Response) => void) | undefined;
        fetchMock.mockReturnValue(new Promise<Response>((resolve) => {
            resolveFetch = resolve;
        }));

        render(
            <RoutineTaskForm
                reference={{
                    units: [{ id: 1, code: "มสช.", name: "มสช." }],
                    categories: [{ id: 1, name: "ระบบคอมพิวเตอร์", sortOrder: 1 }],
                    employees: [{ id: 11, firstName: "สมชาย", lastName: "ใจดี", nickname: null }],
                }}
                initialTask={null}
                onSaved={vi.fn()}
                onCancel={vi.fn()}
            />,
        );

        fireEvent.change(screen.getByDisplayValue("เลือกหน่วยงาน"), { target: { value: "1" } });
        fireEvent.change(screen.getByDisplayValue("เลือกหมวดหมู่"), { target: { value: "1" } });
        fireEvent.change(screen.getByPlaceholderText("เช่น ตรวจสอบค่าใช้จ่ายประจำเดือน"), { target: { value: "ตรวจสอบระบบ" } });
        fireEvent.change(screen.getByLabelText("ค้นหาพนักงาน"), {
            target: { value: "สมชาย" },
        });
        fireEvent.click(screen.getByRole("option", { name: "เพิ่ม สมชาย ใจดี เป็นผู้รับผิดชอบ" }));
        const submit = screen.getByRole("button", { name: "บันทึกแม่แบบงาน" });
        fireEvent.click(submit);
        fireEvent.click(submit);

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        const savingButton = screen.getByRole("button", { name: "กำลังบันทึก…" });
        expect(savingButton).toBeDisabled();
        expect(savingButton.querySelector("svg.animate-spin")).toBeInTheDocument();
        resolveFetch?.(new Response(JSON.stringify({ task: { id: 1 } }), { status: 201 }));
    });

    it("uses the current employee and describes both reminder channels in self-service mode", async () => {
        const onSaved = vi.fn();

        render(
            <RoutineTaskForm
                reference={{
                    units: [{ id: 1, code: "มสช.", name: "มสช." }],
                    categories: [{ id: 1, name: "ระบบคอมพิวเตอร์", sortOrder: 1 }],
                    employees: [{
                        id: 11,
                        firstName: "สมชาย",
                        lastName: "ใจดี",
                        nickname: null,
                    }],
                }}
                initialTask={null}
                mode="SELF_SERVICE"
                onSaved={onSaved}
                onCancel={vi.fn()}
            />,
        );

        expect(screen.getByText("ผู้รับผิดชอบคือคุณ และการแจ้งเตือนจะส่งทั้งในระบบและอีเมล")).toBeInTheDocument();
        expect(screen.getByText("สมชาย ใจดี")).toBeInTheDocument();
        expect(screen.queryByLabelText("ค้นหาพนักงาน")).not.toBeInTheDocument();
        expect(screen.getByText(
            "ตรวจตามเวลาไทย (Asia/Bangkok) และแจ้งเตือนในระบบ อีเมล และ LINE เมื่อผู้รับเชื่อมบัญชีไว้",
        )).toBeInTheDocument();

        fireEvent.change(screen.getByDisplayValue("เลือกหน่วยงาน"), { target: { value: "1" } });
        fireEvent.change(screen.getByDisplayValue("เลือกหมวดหมู่"), { target: { value: "1" } });
        fireEvent.change(screen.getByPlaceholderText("เช่น ตรวจสอบค่าใช้จ่ายประจำเดือน"), {
            target: { value: "งานของฉัน" },
        });
        fireEvent.click(screen.getByRole("button", { name: "บันทึกงานของฉัน" }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
        const body = JSON.parse(String(request.body)) as {
            assignees: Array<{ employeeId: number; role: string }>;
            reminderRules: Array<{ recipientScope: string }>;
        };
        expect(body.assignees).toEqual([{ employeeId: 11, role: "OWNER" }]);
        expect(body.reminderRules).toEqual([]);
        expect(onSaved).toHaveBeenCalledTimes(1);
    });

    it("shows an admin-reassigned employee and preserves that assignee on self-service edit", async () => {
        const initialTask = {
            id: 71,
            unitId: 1,
            categoryId: 1,
            title: "งานที่ถูกมอบหมายใหม่",
            description: null,
            scheduleType: "MONTHLY_DAY",
            scheduleConfig: { day: 10, monthOffset: 0 },
            scheduleText: null,
            contractStartDate: null,
            contractEndDate: null,
            contractText: null,
            extraDetails: null,
            businessDayPolicy: "NONE",
            isActive: true,
            version: 3,
            sourceFileName: null,
            sourceSheet: null,
            sourceRow: null,
            createdById: 3,
            updatedById: 99,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-08-06T00:00:00.000Z",
            unit: { id: 1, code: "มสช.", name: "มสช.", isActive: true },
            category: { id: 1, name: "ระบบคอมพิวเตอร์", sortOrder: 1, isActive: true },
            assignees: [{
                employeeId: 22,
                role: "OWNER",
                employee: {
                    id: 22,
                    firstName: "มานะ",
                    lastName: "ดีใจ",
                    nickname: null,
                    status: "ACTIVE",
                    deletedAt: null,
                },
            }],
            reminderRules: [],
            _count: { occurrences: 1 },
        } satisfies RoutineTask;

        render(
            <RoutineTaskForm
                reference={{
                    units: [{ id: 1, code: "มสช.", name: "มสช." }],
                    categories: [{ id: 1, name: "ระบบคอมพิวเตอร์", sortOrder: 1 }],
                    employees: [{
                        id: 11,
                        firstName: "สมชาย",
                        lastName: "ใจดี",
                        nickname: null,
                    }],
                }}
                initialTask={initialTask}
                mode="SELF_SERVICE"
                onSaved={vi.fn()}
                onCancel={vi.fn()}
            />,
        );

        expect(screen.getByText("มานะ ดีใจ")).toBeInTheDocument();
        expect(screen.queryByText("สมชาย ใจดี")).not.toBeInTheDocument();
        expect(screen.queryByText("ผู้รับผิดชอบคือคุณ และการแจ้งเตือนจะส่งทั้งในระบบและอีเมล")).not.toBeInTheDocument();
        expect(screen.getByText("ผู้รับผิดชอบของงานนี้ถูกปรับโดยผู้ดูแลระบบ")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "บันทึกงานของฉัน" }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
        const body = JSON.parse(String(request.body)) as { assignees?: unknown };
        expect(request.method).toBe("PATCH");
        expect(body).not.toHaveProperty("assignees");
    });
});
