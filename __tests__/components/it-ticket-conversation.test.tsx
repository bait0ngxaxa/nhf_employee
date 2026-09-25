import { webcrypto } from "node:crypto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ITTicketConversation } from "@/modules/it/client";

const ticketId = 19;
const emptyTimeline = {
    success: true,
    items: [],
    olderCursor: null,
    hasMore: false,
};

function jsonResponse(value: unknown, status = 200): Response {
    return new Response(JSON.stringify(value), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

function submittedComment(attachments: readonly Record<string, unknown>[] = []) {
    return {
        success: true,
        replayed: false,
        comment: {
            type: "COMMENT",
            id: "cmtest123",
            createdAt: "2026-09-01T02:00:00.000Z",
            authorDisplayName: "พนักงานทดสอบ",
            authorSide: "REQUESTER",
            body: "ช่วยตรวจสอบด้วยค่ะ",
            attachments,
        },
    };
}

function file(name: string, data: string, type = "image/png"): File {
    return new File([data], name, { type });
}

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    if (originalCreateObjectURL) {
        Object.defineProperty(URL, "createObjectURL", {
            configurable: true,
            value: originalCreateObjectURL,
        });
    } else {
        Reflect.deleteProperty(URL, "createObjectURL");
    }
    if (originalRevokeObjectURL) {
        Object.defineProperty(URL, "revokeObjectURL", {
            configurable: true,
            value: originalRevokeObjectURL,
        });
    } else {
        Reflect.deleteProperty(URL, "revokeObjectURL");
    }
});

function setupFetch(post: (init: RequestInit) => Promise<Response>) {
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
        if (init?.method === "POST") return post(init);
        return jsonResponse(emptyTimeline);
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", webcrypto);
    return fetchMock;
}

function renderConversation(options?: {
    readonly canComment?: boolean;
    readonly status?: "OPEN" | "RESOLVED";
}) {
    return render(
        <ITTicketConversation
            ticketId={ticketId}
            status={options?.status ?? "OPEN"}
            canComment={options?.canComment ?? true}
            operator={false}
        />,
    );
}

describe("IT Ticket conversation attachment UI", () => {
    beforeEach(() => {
        let objectUrl = 0;
        Object.defineProperty(URL, "createObjectURL", {
            configurable: true,
            value: vi.fn(() => `blob:it-ticket-${++objectUrl}`),
        });
        Object.defineProperty(URL, "revokeObjectURL", {
            configurable: true,
            value: vi.fn(),
        });
    });

    it("keeps body-only comments on JSON and hides the composer without permission or in terminal state", async () => {
        let postInit: RequestInit | undefined;
        setupFetch(async (init) => {
            postInit = init;
            return jsonResponse(submittedComment());
        });
        const { rerender } = renderConversation();
        const bodyField = await screen.findByLabelText("ตอบกลับ");
        fireEvent.change(bodyField, { target: { value: "  ช่วยตรวจสอบด้วยค่ะ  " } });
        fireEvent.click(screen.getByRole("button", { name: "ส่งข้อความ" }));
        await screen.findByText("ส่งข้อความเรียบร้อยแล้ว");
        expect(new Headers(postInit?.headers).get("Content-Type")).toBe("application/json");
        expect(postInit?.body).toBe(JSON.stringify({ body: "ช่วยตรวจสอบด้วยค่ะ" }));

        rerender(
            <ITTicketConversation ticketId={ticketId} status="OPEN" canComment={false} operator={false} />,
        );
        expect(screen.queryByLabelText("รูปภาพประกอบ (ไม่บังคับ)")).toBeNull();
        rerender(
            <ITTicketConversation ticketId={ticketId} status="RESOLVED" canComment operator={false} />,
        );
        expect(screen.queryByLabelText("ตอบกลับ")).toBeNull();
    });

    it("shows previews, removes selected files, and submits body plus files as multipart", async () => {
        let postInit: RequestInit | undefined;
        setupFetch(async (init) => {
            postInit = init;
            return jsonResponse(submittedComment([{
                id: "a".repeat(32),
                originalName: "หลักฐาน.png",
                contentType: "image/webp",
                sizeBytes: 8_000,
                width: 320,
                height: 240,
                position: 0,
            }]));
        });
        renderConversation();
        const input = await screen.findByLabelText("รูปภาพประกอบ (ไม่บังคับ)") as HTMLInputElement;
        expect(input.accept).toBe("image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp");

        fireEvent.change(input, { target: { files: [file("first.png", "image-data")] } });
        expect(await screen.findByAltText("ตัวอย่างรูปภาพ first.png")).toBeTruthy();
        expect(screen.getByText(/สูงสุด 3 รูป/)).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "นำรูป first.png ออก" }));
        expect(screen.queryByAltText("ตัวอย่างรูปภาพ first.png")).toBeNull();
        fireEvent.change(input, { target: { files: [file("หลักฐาน.png", "image-data")] } });
        fireEvent.change(screen.getByLabelText("ตอบกลับ"), {
            target: { value: "ช่วยตรวจสอบด้วยค่ะ" },
        });
        fireEvent.click(screen.getByRole("button", { name: "ส่งข้อความ" }));

        await screen.findByText("ส่งข้อความเรียบร้อยแล้ว");
        expect(postInit?.body).toBeInstanceOf(FormData);
        const formData = postInit?.body as FormData;
        expect(formData.get("body")).toBe("ช่วยตรวจสอบด้วยค่ะ");
        expect(formData.getAll("attachments")).toHaveLength(1);
        expect(formData.get("authorSide")).toBeNull();
        expect(screen.getByRole("img", { name: "ภาพแนบจาก พนักงานทดสอบ: หลักฐาน.png" }).getAttribute("src"))
            .toBe(`/api/it/attachments/${"a".repeat(32)}`);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:it-ticket-2");
    });

    it("shows advisory errors for invalid type, per-file, total-size, and count limits", async () => {
        setupFetch(async () => jsonResponse(submittedComment()));
        renderConversation();
        const input = await screen.findByLabelText("รูปภาพประกอบ (ไม่บังคับ)") as HTMLInputElement;

        fireEvent.change(input, { target: { files: [file("bad.pdf", "x", "application/pdf")] } });
        expect(await screen.findByRole("alert")).toHaveTextContent("JPG, PNG และ WEBP");
        fireEvent.change(input, {
            target: { files: [new File([new Uint8Array(8 * 1024 * 1024 + 1)], "large.png", { type: "image/png" })] },
        });
        expect(await screen.findByRole("alert")).toHaveTextContent("8 MiB");
        fireEvent.change(input, {
            target: {
                files: [
                    new File([new Uint8Array(7 * 1024 * 1024)], "1.png", { type: "image/png" }),
                    new File([new Uint8Array(7 * 1024 * 1024)], "2.png", { type: "image/png" }),
                    new File([new Uint8Array(7 * 1024 * 1024)], "3.png", { type: "image/png" }),
                ],
            },
        });
        expect(await screen.findByRole("alert")).toHaveTextContent("20 MiB");

        fireEvent.change(input, { target: { files: [
            file("1.png", "1"), file("2.png", "2"), file("3.png", "3"),
        ] } });
        expect(await screen.findByAltText("ตัวอย่างรูปภาพ 3.png")).toBeTruthy();
        fireEvent.change(input, { target: { files: [file("4.png", "4")] } });
        expect(await screen.findByRole("alert")).toHaveTextContent("สูงสุด 3");
    });

    it("reuses the idempotency key after an uncertain failure and changes it with the files", async () => {
        const keys: string[] = [];
        let postCount = 0;
        setupFetch(async (init) => {
            const headers = new Headers(init.headers);
            keys.push(headers.get("Idempotency-Key") ?? "");
            postCount += 1;
            if (postCount === 1 || postCount === 3) throw new Error("network unavailable");
            return jsonResponse(submittedComment());
        });
        renderConversation();
        const input = await screen.findByLabelText("รูปภาพประกอบ (ไม่บังคับ)") as HTMLInputElement;
        fireEvent.change(screen.getByLabelText("ตอบกลับ"), { target: { value: "ข้อความเดิม" } });
        fireEvent.change(input, { target: { files: [file("first.png", "one")] } });
        fireEvent.click(screen.getByRole("button", { name: "ส่งข้อความ" }));
        await screen.findByRole("alert");
        expect((screen.getByLabelText("ตอบกลับ") as HTMLTextAreaElement).value).toBe("ข้อความเดิม");
        expect(await screen.findByAltText("ตัวอย่างรูปภาพ first.png")).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: "ส่งข้อความ" }));
        await screen.findByText("ส่งข้อความเรียบร้อยแล้ว");
        expect(keys[0]).toBe(keys[1]);

        fireEvent.change(screen.getByLabelText("ตอบกลับ"), { target: { value: "ข้อความใหม่" } });
        fireEvent.change(input, { target: { files: [file("second.png", "two")] } });
        fireEvent.click(screen.getByRole("button", { name: "ส่งข้อความ" }));
        await screen.findByRole("alert");
        fireEvent.click(screen.getByRole("button", { name: "นำรูป second.png ออก" }));
        fireEvent.change(input, { target: { files: [file("third.png", "three")] } });
        fireEvent.click(screen.getByRole("button", { name: "ส่งข้อความ" }));
        await waitFor(() => expect(keys).toHaveLength(4));
        expect(keys[2]).not.toBe(keys[3]);
    });
});
