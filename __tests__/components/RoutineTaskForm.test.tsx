import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { RoutineTaskForm } from "@/components/dashboard/routine/RoutineTaskForm";

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
                onSaved={onSaved}
                onCancel={vi.fn()}
            />,
        );

        expect(screen.queryByText("Schedule config (JSON)")).not.toBeInTheDocument();
        expect(screen.getByText("วันที่ของเดือน")).toBeInTheDocument();

        fireEvent.change(screen.getByDisplayValue("เลือกหน่วยงาน"), {
            target: { value: "1" },
        });
        fireEvent.change(screen.getByDisplayValue("เลือกหมวดหมู่"), {
            target: { value: "1" },
        });
        fireEvent.change(screen.getByPlaceholderText("เช่น ตรวจสอบค่าใช้จ่ายประจำเดือน"), {
            target: { value: "ตรวจสอบระบบ" },
        });
        fireEvent.click(screen.getByRole("checkbox", { name: "เลือก สมชาย ใจดี" }));
        fireEvent.change(screen.getByLabelText("เลือกชุดกฎการแจ้งเตือน"), {
            target: { value: "monthly" },
        });

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
        fireEvent.click(screen.getByRole("checkbox", { name: "เลือก สมชาย ใจดี" }));
        const submit = screen.getByRole("button", { name: "บันทึกแม่แบบงาน" });
        fireEvent.click(submit);
        fireEvent.click(submit);

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        resolveFetch?.(new Response(JSON.stringify({ task: { id: 1 } }), { status: 201 }));
    });
});
