import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ITTicketStatus } from "@prisma/client";

const mocks = vi.hoisted(() => ({
    fetchTimeline: vi.fn(),
    postComment: vi.fn(),
    fetchAttachment: vi.fn(),
}));

vi.mock("./api", () => ({
    fetchLiffITTicketTimeline: mocks.fetchTimeline,
    postLiffITTicketComment: mocks.postComment,
    fetchLiffITAttachment: mocks.fetchAttachment,
}));

import { LiffApiError } from "@/modules/line/client";
import { LiffITConversation } from "./LiffITConversation";

const COMMENT = {
    type: "COMMENT" as const,
    id: "comment-latest",
    createdAt: "2026-09-26T04:00:00.000Z",
    authorDisplayName: "เจ้าหน้าที่ทดสอบ",
    authorSide: "OPERATOR" as const,
    body: "ข้อความล่าสุดจากเจ้าหน้าที่",
    attachments: [],
};

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}

function renderConversation(
    status: ITTicketStatus = "OPEN",
    refreshVersion = 0,
    onTicketRefresh = vi.fn(),
) {
    return render(
        <LiffITConversation
            ticketId={42}
            status={status}
            refreshVersion={refreshVersion}
            ticketRefreshing={false}
            onTicketRefresh={onTicketRefresh}
        />,
    );
}

describe("LiffITConversation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        let key = 0;
        vi.stubGlobal("crypto", {
            randomUUID: () => `comment-attempt-${++key}`,
            subtle: { digest: vi.fn().mockResolvedValue(new Uint8Array([1]).buffer) },
        } as unknown as Crypto);
        Object.defineProperty(URL, "createObjectURL", {
            configurable: true,
            value: vi.fn().mockImplementation(() => "blob:preview"),
        });
        Object.defineProperty(URL, "revokeObjectURL", {
            configurable: true,
            value: vi.fn(),
        });
        mocks.fetchTimeline.mockResolvedValue({ items: [], olderCursor: null, hasMore: false });
        mocks.postComment.mockResolvedValue({ comment: COMMENT, replayed: false });
        mocks.fetchAttachment.mockResolvedValue(new Blob(["private image"], { type: "image/webp" }));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        Reflect.deleteProperty(URL, "createObjectURL");
        Reflect.deleteProperty(URL, "revokeObjectURL");
    });

    it("renders requester comments, IT comments, and lifecycle events without operator reference details", async () => {
        mocks.fetchTimeline.mockResolvedValueOnce({
            items: [
                {
                    type: "CREATED",
                    id: 1,
                    createdAt: "2026-09-25T01:00:00.000Z",
                    actorDisplayName: "ผู้แจ้ง",
                },
                {
                    type: "COMMENT",
                    id: "requester-comment",
                    createdAt: "2026-09-25T02:00:00.000Z",
                    authorDisplayName: "ผู้แจ้งทดสอบ",
                    authorSide: "REQUESTER",
                    body: "ข้อความจากผู้แจ้ง",
                    attachments: [],
                },
                {
                    ...COMMENT,
                    id: "it-comment",
                    createdAt: "2026-09-25T03:00:00.000Z",
                },
                {
                    type: "STATUS_CHANGED",
                    id: 2,
                    createdAt: "2026-09-25T04:00:00.000Z",
                    actorDisplayName: "IT ภายใน",
                    fromStatus: "OPEN",
                    toStatus: "IN_PROGRESS",
                },
                {
                    type: "ASSIGNED",
                    id: 3,
                    createdAt: "2026-09-25T05:00:00.000Z",
                    actorDisplayName: "IT ภายใน",
                    fromAssigneeDisplayName: "ผู้รับผิดชอบเดิม",
                    toAssigneeDisplayName: "ผู้รับผิดชอบใหม่",
                },
                {
                    type: "CATEGORY_CHANGED",
                    id: 4,
                    createdAt: "2026-09-25T06:00:00.000Z",
                    actorDisplayName: "IT ภายใน",
                    fromCategoryName: "หมวดหมู่ลับเดิม",
                    toCategoryName: "หมวดหมู่ลับใหม่",
                },
            ],
            olderCursor: null,
            hasMore: false,
        });
        renderConversation();

        const timeline = await screen.findByRole("list", { name: "ลำดับการสนทนาและเหตุการณ์ Ticket" });
        expect(within(timeline).getByText("สร้าง Ticket แล้ว")).toBeInTheDocument();
        expect(within(timeline).getByText("ข้อความจากผู้แจ้ง")).toBeInTheDocument();
        expect(within(timeline).getByText("ข้อความล่าสุดจากเจ้าหน้าที่")).toBeInTheDocument();
        expect(within(timeline).getByText("เปลี่ยนสถานะจาก รับเรื่องแล้ว เป็น กำลังดำเนินการ")).toBeInTheDocument();
        expect(within(timeline).getByText("เจ้าหน้าที่ IT อัปเดตการรับเรื่อง")).toBeInTheDocument();
        expect(within(timeline).getByText("เจ้าหน้าที่ IT ปรับข้อมูลการจัดหมวดหมู่")).toBeInTheDocument();
        expect(within(timeline).queryByText("ผู้รับผิดชอบใหม่")).not.toBeInTheDocument();
        expect(within(timeline).queryByText("หมวดหมู่ลับใหม่")).not.toBeInTheDocument();
    });

    it("loads older history with the server cursor and keeps chronological ordering", async () => {
        mocks.fetchTimeline
            .mockResolvedValueOnce({ items: [COMMENT], olderCursor: "opaque-cursor", hasMore: true })
            .mockResolvedValueOnce({
                items: [{
                    type: "COMMENT",
                    id: "comment-older",
                    createdAt: "2026-09-25T01:00:00.000Z",
                    authorDisplayName: "ผู้แจ้ง",
                    authorSide: "REQUESTER",
                    body: "ข้อความเก่ากว่า",
                    attachments: [],
                }],
                olderCursor: null,
                hasMore: false,
            });
        renderConversation();
        await screen.findByText("ข้อความล่าสุดจากเจ้าหน้าที่");
        fireEvent.click(screen.getByRole("button", { name: "ดูประวัติก่อนหน้า" }));

        const older = await screen.findByText("ข้อความเก่ากว่า");
        const latest = screen.getByText("ข้อความล่าสุดจากเจ้าหน้าที่");
        expect(older.compareDocumentPosition(latest) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(mocks.fetchTimeline).toHaveBeenNthCalledWith(2, 42, {
            cursor: "opaque-cursor",
            signal: expect.any(AbortSignal),
        });
    });

    it("retries timeline failures and shows a useful empty history state", async () => {
        mocks.fetchTimeline
            .mockRejectedValueOnce(new LiffApiError("ไม่พบ Ticket หรือคุณไม่มีสิทธิ์ดูรายการนี้", 404))
            .mockResolvedValueOnce({ items: [], olderCursor: null, hasMore: false });
        renderConversation();

        expect(await screen.findByRole("alert")).toHaveTextContent("ไม่พบ Ticket หรือคุณไม่มีสิทธิ์ดูรายการนี้");
        fireEvent.click(screen.getByRole("button", { name: "โหลดประวัติอีกครั้ง" }));
        expect(await screen.findByText("ยังไม่มีข้อความหรือประวัติการดำเนินการ")).toBeInTheDocument();
    });

    it.each(["OPEN", "IN_PROGRESS", "WAITING_REQUESTER"] as const)(
        "allows a requester reply while the Ticket is %s",
        async (status) => {
            renderConversation(status);
            expect(await screen.findByRole("textbox", { name: "ตอบกลับ" })).toBeInTheDocument();
        },
    );

    it.each(["RESOLVED", "CLOSED", "CANCELLED"] as const)(
        "keeps %s history readable without showing a reply form",
        async (status) => {
            mocks.fetchTimeline.mockResolvedValueOnce({ items: [COMMENT], olderCursor: null, hasMore: false });
            renderConversation(status);
            expect(await screen.findByText("ข้อความล่าสุดจากเจ้าหน้าที่")).toBeInTheDocument();
            expect(screen.getByText(`Ticket นี้อยู่ในสถานะ ${status === "RESOLVED" ? "แก้ไขแล้ว" : status === "CLOSED" ? "ปิดงานแล้ว" : "ยกเลิกแล้ว"} จึงอ่านประวัติได้ แต่ไม่สามารถส่งข้อความตอบกลับได้`)).toBeInTheDocument();
            expect(screen.queryByRole("textbox", { name: "ตอบกลับ" })).not.toBeInTheDocument();
        },
    );

    it("reuses a failed comment key for the same body and creates a new one when the body changes", async () => {
        mocks.postComment
            .mockRejectedValueOnce(new LiffApiError("ระบบ Ticket ขัดข้องชั่วคราว กรุณาลองอีกครั้ง", 503))
            .mockRejectedValueOnce(new LiffApiError("ระบบ Ticket ขัดข้องชั่วคราว กรุณาลองอีกครั้ง", 503))
            .mockResolvedValueOnce({ comment: COMMENT, replayed: false });
        renderConversation();
        await screen.findByRole("textbox", { name: "ตอบกลับ" });
        const composer = screen.getByRole("textbox", { name: "ตอบกลับ" });
        fireEvent.change(composer, { target: { value: "ข้อความเดิม" } });
        fireEvent.click(screen.getByRole("button", { name: "ส่งข้อความ" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("ระบบ Ticket ขัดข้องชั่วคราว");
        fireEvent.click(screen.getByRole("button", { name: "ส่งข้อความ" }));
        await waitFor(() => expect(mocks.postComment).toHaveBeenCalledTimes(2));
        expect(mocks.postComment.mock.calls[0]?.[3]).toBe("comment-attempt-1");
        expect(mocks.postComment.mock.calls[1]?.[3]).toBe("comment-attempt-1");

        fireEvent.change(composer, { target: { value: "ข้อความใหม่" } });
        fireEvent.click(screen.getByRole("button", { name: "ส่งข้อความ" }));
        await waitFor(() => expect(mocks.postComment).toHaveBeenCalledTimes(3));
        expect(mocks.postComment.mock.calls[2]?.[3]).toBe("comment-attempt-2");
    });

    it("keeps selected evidence in a failed retry signature and changes the attempt after selection changes", async () => {
        mocks.postComment
            .mockRejectedValueOnce(new LiffApiError("ระบบ Ticket ขัดข้องชั่วคราว กรุณาลองอีกครั้ง", 503))
            .mockRejectedValueOnce(new LiffApiError("ระบบ Ticket ขัดข้องชั่วคราว กรุณาลองอีกครั้ง", 503))
            .mockResolvedValueOnce({ comment: COMMENT, replayed: false });
        renderConversation();
        fireEvent.change(await screen.findByRole("textbox", { name: "ตอบกลับ" }), {
            target: { value: "ข้อความพร้อมหลักฐาน" },
        });
        fireEvent.change(screen.getByLabelText("รูปภาพประกอบ (ไม่บังคับ)"), {
            target: { files: [new File(["evidence"], "หลักฐาน.png", { type: "image/png" })] },
        });
        fireEvent.click(screen.getByRole("button", { name: "ส่งข้อความ" }));
        await screen.findByRole("alert");
        fireEvent.click(screen.getByRole("button", { name: "ส่งข้อความ" }));
        await waitFor(() => expect(mocks.postComment).toHaveBeenCalledTimes(2));

        expect(mocks.postComment.mock.calls[0]?.[2]).toHaveLength(1);
        expect(mocks.postComment.mock.calls[1]?.[2]).toHaveLength(1);
        expect(mocks.postComment.mock.calls[0]?.[3]).toBe("comment-attempt-1");
        expect(mocks.postComment.mock.calls[1]?.[3]).toBe("comment-attempt-1");
        fireEvent.click(screen.getByRole("button", { name: "นำรูปภาพ หลักฐาน.png ออก" }));
        fireEvent.click(screen.getByRole("button", { name: "ส่งข้อความ" }));
        await waitFor(() => expect(mocks.postComment).toHaveBeenCalledTimes(3));
        expect(mocks.postComment.mock.calls[2]?.[2]).toEqual([]);
        expect(mocks.postComment.mock.calls[2]?.[3]).toBe("comment-attempt-2");
    });

    it("validates evidence and cleans up preview URLs on removal and unmount", async () => {
        let urlIndex = 0;
        const createObjectURL = vi.fn(() => `blob:preview-${++urlIndex}`);
        const revokeObjectURL = vi.fn();
        Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectURL });
        Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
        const view = renderConversation();
        const picker = await screen.findByLabelText("รูปภาพประกอบ (ไม่บังคับ)");

        fireEvent.change(picker, {
            target: { files: [new File(["wrong"], "evidence.pdf", { type: "application/pdf" })] },
        });
        expect(await screen.findByRole("alert")).toHaveTextContent("รองรับเฉพาะรูปภาพ JPG, PNG และ WEBP");
        expect(createObjectURL).not.toHaveBeenCalled();

        fireEvent.change(picker, {
            target: { files: [
                new File(["first"], "หลักฐาน.png", { type: "image/png" }),
                new File(["second"], "อีกภาพ.webp", { type: "image/webp" }),
            ] },
        });
        expect(await screen.findByAltText("ตัวอย่างรูปภาพ หลักฐาน.png")).toHaveAttribute("src", "blob:preview-1");
        expect(screen.getByAltText("ตัวอย่างรูปภาพ อีกภาพ.webp")).toHaveAttribute("src", "blob:preview-2");
        fireEvent.click(screen.getByRole("button", { name: "นำรูปภาพ หลักฐาน.png ออก" }));
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview-1");
        view.unmount();
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview-2");
    });

    it("retrieves private evidence through the LIFF client and revokes the Blob URL", async () => {
        Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:private-image") });
        const revokeObjectURL = vi.fn();
        Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectURL });
        mocks.fetchTimeline.mockResolvedValueOnce({
            items: [{
                type: "COMMENT",
                id: "comment-image",
                createdAt: "2026-09-25T03:00:00.000Z",
                authorDisplayName: "เจ้าหน้าที่ IT",
                authorSide: "OPERATOR",
                body: "ดูภาพประกอบ",
                attachments: [{
                    id: "private-attachment-id",
                    originalName: "หลักฐาน.webp",
                    contentType: "image/webp",
                    sizeBytes: 128,
                    width: 120,
                    height: 90,
                    position: 0,
                }],
            }],
            olderCursor: null,
            hasMore: false,
        });
        const view = renderConversation();

        const image = await screen.findByAltText("รูปภาพประกอบ: หลักฐาน.webp");
        expect(image).toHaveAttribute("src", "blob:private-image");
        expect(mocks.fetchAttachment).toHaveBeenCalledWith(
            "private-attachment-id",
            expect.any(AbortSignal),
        );
        view.unmount();
        expect(revokeObjectURL).toHaveBeenCalledWith("blob:private-image");
    });

    it("does not let an older timeline response replace a newer Ticket timeline", async () => {
        const older = deferred<{ items: Array<typeof COMMENT>; olderCursor: null; hasMore: false }>();
        const latest = deferred<{ items: Array<typeof COMMENT>; olderCursor: null; hasMore: false }>();
        mocks.fetchTimeline.mockImplementation((id: number) => id === 1 ? older.promise : latest.promise);
        const view = render(
            <LiffITConversation ticketId={1} status="OPEN" refreshVersion={0} ticketRefreshing={false} onTicketRefresh={vi.fn()} />,
        );
        view.rerender(
            <LiffITConversation ticketId={2} status="OPEN" refreshVersion={0} ticketRefreshing={false} onTicketRefresh={vi.fn()} />,
        );

        await act(async () => latest.resolve({ items: [{ ...COMMENT, body: "ประวัติ Ticket ล่าสุด" }], olderCursor: null, hasMore: false }));
        expect(await screen.findByText("ประวัติ Ticket ล่าสุด")).toBeInTheDocument();
        await act(async () => older.resolve({ items: [{ ...COMMENT, body: "ประวัติ Ticket เก่า" }], olderCursor: null, hasMore: false }));
        expect(screen.getByText("ประวัติ Ticket ล่าสุด")).toBeInTheDocument();
        expect(screen.queryByText("ประวัติ Ticket เก่า")).not.toBeInTheDocument();
    });

    it("blocks a conflicting reply until the user reloads the Ticket state", async () => {
        const onTicketRefresh = vi.fn();
        mocks.postComment.mockRejectedValueOnce(new LiffApiError(
            "Ticket มีการเปลี่ยนแปลง กรุณาตรวจสอบสถานะล่าสุดก่อนลองอีกครั้ง",
            409,
        ));
        const view = renderConversation("IN_PROGRESS", 0, onTicketRefresh);
        await screen.findByRole("textbox", { name: "ตอบกลับ" });
        fireEvent.change(screen.getByRole("textbox", { name: "ตอบกลับ" }), {
            target: { value: "ขออัปเดต" },
        });
        fireEvent.click(screen.getByRole("button", { name: "ส่งข้อความ" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("Ticket มีการเปลี่ยนแปลง");
        const reloadButton = await screen.findByRole("button", { name: "โหลดสถานะ Ticket ล่าสุด" });
        fireEvent.click(reloadButton);
        expect(onTicketRefresh).toHaveBeenCalledTimes(1);

        view.rerender(
            <LiffITConversation ticketId={42} status="OPEN" refreshVersion={1} ticketRefreshing={false} onTicketRefresh={onTicketRefresh} />,
        );
        expect(await screen.findByRole("textbox", { name: "ตอบกลับ" })).toBeInTheDocument();
    });
});
