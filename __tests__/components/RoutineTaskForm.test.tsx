import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RoutineTaskForm } from "@/components/dashboard/routine/RoutineTaskForm";
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
        expect(screen.getAllByRole("option", { name: "มสช." })).toHaveLength(1);
        expect(screen.getByRole("option", { name: "เลือกรูปแบบการแจ้งเตือน" })).toBeInTheDocument();
        expect(screen.getByLabelText("เลือกชุดกฎการแจ้งเตือน")).toHaveValue("");

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

        fireEvent.click(screen.getByRole("button", { name: "บันทึกแม่แบบงาน" }));

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
        const body = JSON.parse(String(request.body)) as {
            reminderRules: Array<{ daysBefore: number; sendHour: number; channel: string }>;
        };

        expect(body.reminderRules).toEqual([
            { daysBefore: 3, sendHour: 9, channel: "IN_APP", recipientScope: "ASSIGNEES", isActive: true },
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
        expect(screen.getByText(/แจ้งเตือนทั้งในระบบและอีเมล/)).toBeInTheDocument();

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
