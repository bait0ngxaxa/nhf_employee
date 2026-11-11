import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { allowDashboardNavigation } from "@/lib/ui/dashboard-navigation-guard";
import { ITTicketConversation } from "./ITTicketConversation";

interface CapturedSubmission {
    readonly body: string;
    readonly attachments: readonly string[];
}

function jsonResponse(payload: unknown): Response {
    return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
    });
}

const createObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
const revokeObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, "revokeObjectURL");
let capturedRequests: Array<{ readonly key: string; readonly submission: CapturedSubmission }> = [];
let logicalSubmissionCount = 0;

describe("ITTicketConversation mutation recovery", () => {
    beforeEach(() => {
        vi.spyOn(window, "alert").mockImplementation(() => {});
        vi.spyOn(window, "confirm").mockReturnValue(true);
        capturedRequests = [];
        logicalSubmissionCount = 0;
        let requestCount = 0;
        const accepted = new Map<string, CapturedSubmission>();
        vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (_input, init) => {
            if (init?.method !== "POST") {
                return jsonResponse({ success: true, items: [], olderCursor: null, hasMore: false });
            }

            const key = new Headers(init.headers).get("Idempotency-Key");
            if (!key) throw new Error("Comment request was missing its idempotency key");
            const requestBody = init.body;
            const submission: CapturedSubmission = requestBody instanceof FormData
                ? {
                    body: String(requestBody.get("body")),
                    attachments: requestBody.getAll("attachments").map((file) =>
                        file instanceof File ? `${file.name}:${file.size}` : String(file),
                    ),
                }
                : {
                    body: (JSON.parse(String(requestBody)) as { readonly body: string }).body,
                    attachments: [],
                };
            const existing = accepted.get(key);
            if (existing) {
                expect(submission).toEqual(existing);
            } else {
                accepted.set(key, submission);
                logicalSubmissionCount += 1;
            }
            capturedRequests.push({ key, submission });
            requestCount += 1;

            // The simulated server commits the first request, but the client never receives its response.
            if (requestCount < 3) throw new TypeError("The response was lost after server commit");
            expect(logicalSubmissionCount).toBe(1);
            return jsonResponse({
                success: true,
                replayed: true,
                comment: {
                    id: "comment-19",
                    createdAt: "2026-10-01T03:30:00.000Z",
                    authorDisplayName: "เจ้าหน้าที่ IT",
                    authorSide: "OPERATOR",
                    body: submission.body,
                    attachments: [],
                },
            });
        }));
        Object.defineProperty(URL, "createObjectURL", {
            configurable: true,
            value: vi.fn(() => "blob:comment-attachment"),
        });
        Object.defineProperty(URL, "revokeObjectURL", {
            configurable: true,
            value: vi.fn(),
        });
    });

    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        if (createObjectUrlDescriptor) {
            Object.defineProperty(URL, "createObjectURL", createObjectUrlDescriptor);
        } else {
            Reflect.deleteProperty(URL, "createObjectURL");
        }
        if (revokeObjectUrlDescriptor) {
            Object.defineProperty(URL, "revokeObjectURL", revokeObjectUrlDescriptor);
        } else {
            Reflect.deleteProperty(URL, "revokeObjectURL");
        }
    });

    it.each(["permission", "status"])("offers an explicit recovery exit after %s changes without losing retry identity", async (change) => {
        const view = render(<ITTicketConversation ticketId={19} status="OPEN" canComment operator />);
        await screen.findByText("ยังไม่มีข้อความในบทสนทนา");
        fireEvent.change(screen.getByRole("textbox", { name: "ตอบกลับ" }), { target: { value: "ข้อความเดิม" } });
        fireEvent.click(screen.getByRole("button", { name: "ส่งข้อความ" }));
        await screen.findByRole("alert");
        view.rerender(<ITTicketConversation ticketId={19} status={change === "status" ? "CLOSED" : "OPEN"} canComment={change !== "permission"} operator />);
        expect(allowDashboardNavigation()).toBe(false);
        expect(screen.queryByRole("button", { name: "ส่งข้อความเดิมอีกครั้ง" })).not.toBeInTheDocument();
        vi.mocked(window.confirm).mockReturnValueOnce(false);
        fireEvent.click(screen.getByRole("button", { name: "รับทราบความเสี่ยงและอนุญาตให้ออกจากหน้านี้" }));
        expect(allowDashboardNavigation()).toBe(false);
        fireEvent.click(screen.getByRole("button", { name: "รับทราบความเสี่ยงและอนุญาตให้ออกจากหน้านี้" }));
        expect(allowDashboardNavigation()).toBe(true);
        view.rerender(<ITTicketConversation ticketId={19} status="OPEN" canComment operator />);
        expect(screen.getByRole("textbox", { name: "ตอบกลับ" })).toHaveValue("ข้อความเดิม");
        fireEvent.click(screen.getByRole("button", { name: "ส่งข้อความเดิมอีกครั้ง" }));
        await screen.findByRole("alert");
        fireEvent.click(screen.getByRole("button", { name: "ส่งข้อความเดิมอีกครั้ง" }));
        await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("ถูกส่งเรียบร้อยแล้ว"));
        expect(new Set(capturedRequests.map((request) => request.key)).size).toBe(1);
        expect(capturedRequests.every((request) => request.submission.body === "ข้อความเดิม")).toBe(true);
    });

    it("locks the original message and attachment through lost responses and resolves with one idempotent submission", async () => {
        const fetchMock = globalThis.fetch;
        render(<ITTicketConversation ticketId={19} status="OPEN" canComment operator />);
        await screen.findByText("ยังไม่มีข้อความในบทสนทนา");

        const textarea = screen.getByRole("textbox", { name: "ตอบกลับ" });
        fireEvent.change(textarea, { target: { value: "ข้อความเดิม" } });
        const attachmentInput = screen.getByLabelText("รูปภาพประกอบ (ไม่บังคับ)");
        const originalFile = new File(["original-image"], "original.png", { type: "image/png" });
        fireEvent.change(attachmentInput, { target: { files: [originalFile] } });
        expect(await screen.findByText("original.png")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "ส่งข้อความ" }));
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
        expect(allowDashboardNavigation()).toBe(false);
        expect(textarea).toBeDisabled();
        expect(attachmentInput).toBeDisabled();
        expect(screen.getByRole("button", { name: "นำรูป original.png ออก" })).toBeDisabled();

        fireEvent.change(textarea, { target: { value: "ข้อความใหม่" } });
        fireEvent.change(attachmentInput, {
            target: { files: [new File(["replacement"], "replacement.png", { type: "image/png" })] },
        });
        expect(textarea).toHaveValue("ข้อความเดิม");
        expect(screen.getByText("original.png")).toBeInTheDocument();
        expect(screen.queryByText("replacement.png")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "ส่งข้อความเดิมอีกครั้ง" }));
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
        expect(allowDashboardNavigation()).toBe(false);
        fireEvent.click(screen.getByRole("button", { name: "ส่งข้อความเดิมอีกครั้ง" }));

        await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("ถูกส่งเรียบร้อยแล้ว"));
        expect(allowDashboardNavigation()).toBe(true);
        expect(textarea).toHaveValue("");
        expect(document.querySelector('[data-navigation-unresolved="true"]')).not.toBeInTheDocument();
        expect(logicalSubmissionCount).toBe(1);

        expect(capturedRequests).toHaveLength(3);
        expect(new Set(capturedRequests.map((request) => request.key)).size).toBe(1);
        expect(capturedRequests.map((request) => request.submission)).toEqual([
            { body: "ข้อความเดิม", attachments: ["original.png:14"] },
            { body: "ข้อความเดิม", attachments: ["original.png:14"] },
            { body: "ข้อความเดิม", attachments: ["original.png:14"] },
        ]);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:comment-attachment");
    });
});
