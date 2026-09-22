import { useState, type ReactElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LeaveAttachmentViewerDialog } from "./LeaveAttachmentViewerDialog";
import { fetchLeaveAttachmentImage } from "../api";
import type { LeaveAttachmentSummary } from "../../types";

vi.mock("../api", () => ({
    fetchLeaveAttachmentImage: vi.fn(),
}));

const attachments: LeaveAttachmentSummary[] = [
    {
        id: "attachment-1",
        contentType: "image/webp",
        sizeBytes: 12_345,
        width: 1200,
        height: 800,
        viewUrl: "/api/leave/attachments/attachment-1",
    },
    {
        id: "attachment-2",
        contentType: "image/webp",
        sizeBytes: 67_890,
        width: 800,
        height: 1200,
        viewUrl: "/api/leave/attachments/attachment-2",
    },
];

const threeAttachments: LeaveAttachmentSummary[] = [
    ...attachments,
    {
        id: "attachment-3",
        contentType: "image/webp",
        sizeBytes: 23_456,
        width: 1200,
        height: 1200,
        viewUrl: "/api/leave/attachments/attachment-3",
    },
];

const attachmentA: LeaveAttachmentSummary = {
    ...attachments[0],
    id: "attachment-a",
    viewUrl: "/api/leave/attachments/attachment-a",
};

const attachmentsB: LeaveAttachmentSummary[] = [
    {
        ...attachments[0],
        id: "attachment-b-1",
        viewUrl: "/api/leave/attachments/attachment-b-1",
    },
    {
        ...attachments[1],
        id: "attachment-b-2",
        viewUrl: "/api/leave/attachments/attachment-b-2",
    },
    {
        ...threeAttachments[2],
        id: "attachment-b-3",
        viewUrl: "/api/leave/attachments/attachment-b-3",
    },
];

function createDeferred<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
} {
    let resolvePromise: (value: T) => void = () => undefined;
    const promise = new Promise<T>((resolve) => {
        resolvePromise = resolve;
    });
    return { promise, resolve: resolvePromise };
}

function ViewerHarness({
    initialAttachments,
    nextAttachments,
}: {
    readonly initialAttachments: LeaveAttachmentSummary[];
    readonly nextAttachments: LeaveAttachmentSummary[];
}): ReactElement {
    const [open, setOpen] = useState(true);
    const [currentAttachments, setCurrentAttachments] = useState(initialAttachments);

    return (
        <>
            <button type="button" onClick={() => setOpen(true)}>เปิด viewer</button>
            <button type="button" onClick={() => setCurrentAttachments(nextAttachments)}>
                เปลี่ยนชุดไฟล์
            </button>
            <LeaveAttachmentViewerDialog
                open={open}
                attachments={currentAttachments}
                onOpenChange={setOpen}
            />
        </>
    );
}

describe("LeaveAttachmentViewerDialog", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(fetchLeaveAttachmentImage).mockImplementation(async () =>
            new Blob(["image"], { type: "image/webp" }),
        );
        Object.defineProperty(URL, "createObjectURL", {
            configurable: true,
            value: vi.fn((blob: Blob) => `blob:${blob.size}`),
        });
        Object.defineProperty(URL, "revokeObjectURL", {
            configurable: true,
            value: vi.fn(),
        });
    });

    afterEach(() => {
        Reflect.deleteProperty(URL, "createObjectURL");
        Reflect.deleteProperty(URL, "revokeObjectURL");
    });

    it("opens the first image with loading state and a private new-tab link", async () => {
        render(
            <LeaveAttachmentViewerDialog
                open
                attachments={attachments}
                onOpenChange={vi.fn()}
            />,
        );

        expect(
            screen.getByRole("dialog", { name: "ไฟล์แนบคำขอลา" }),
        ).toBeInTheDocument();
        expect(screen.getByText("กำลังโหลดไฟล์แนบ…")).toBeInTheDocument();

        expect(
            await screen.findByAltText("ไฟล์แนบคำขอลา รูปที่ 1 จาก 2"),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: "เปิดไฟล์แนบในแท็บใหม่" })
                .getAttribute("href"),
        ).toMatch(/^blob:/);
        expect(fetchLeaveAttachmentImage).toHaveBeenCalledWith(
            "attachment-1",
            expect.any(AbortSignal),
        );
        await waitFor(() =>
            expect(screen.queryByText("กำลังโหลดไฟล์แนบ…")).not.toBeInTheDocument(),
        );
    });

    it("changes images with controls and keyboard navigation", async () => {
        render(
            <LeaveAttachmentViewerDialog
                open
                attachments={attachments}
                onOpenChange={vi.fn()}
            />,
        );

        await screen.findByAltText("ไฟล์แนบคำขอลา รูปที่ 1 จาก 2");
        fireEvent.click(screen.getByRole("button", { name: "ดูรูปถัดไป" }));
        expect(
            await screen.findByAltText("ไฟล์แนบคำขอลา รูปที่ 2 จาก 2"),
        ).toBeInTheDocument();

        fireEvent.keyDown(document, { key: "ArrowLeft" });
        expect(
            screen.getByAltText("ไฟล์แนบคำขอลา รูปที่ 1 จาก 2"),
        ).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "ดูไฟล์แนบรูปที่ 2" }));
        expect(
            screen.getByAltText("ไฟล์แนบคำขอลา รูปที่ 2 จาก 2"),
        ).toBeInTheDocument();
    });

    it("loads the active image and prefetches only the next image", async () => {
        render(
            <LeaveAttachmentViewerDialog
                open
                attachments={threeAttachments}
                onOpenChange={vi.fn()}
            />,
        );

        await screen.findByAltText("ไฟล์แนบคำขอลา รูปที่ 1 จาก 3");
        await waitFor(() =>
            expect(fetchLeaveAttachmentImage).toHaveBeenCalledTimes(2),
        );
        expect(
            vi.mocked(fetchLeaveAttachmentImage).mock.calls.map(([id]) => id),
        ).toEqual(["attachment-1", "attachment-2"]);

        fireEvent.click(screen.getByRole("button", { name: "ดูรูปถัดไป" }));
        await screen.findByAltText("ไฟล์แนบคำขอลา รูปที่ 2 จาก 3");
        await waitFor(() =>
            expect(fetchLeaveAttachmentImage).toHaveBeenCalledTimes(3),
        );
        expect(fetchLeaveAttachmentImage).toHaveBeenLastCalledWith(
            "attachment-3",
            expect.any(AbortSignal),
        );
    });

    it("shows a general error when the private image cannot be opened", async () => {
        vi.mocked(fetchLeaveAttachmentImage).mockRejectedValue(
            new Error("not found"),
        );
        render(
            <LeaveAttachmentViewerDialog
                open
                attachments={attachments}
                onOpenChange={vi.fn()}
            />,
        );

        expect(
            await screen.findByText("ไม่สามารถเปิดไฟล์แนบได้ กรุณาลองใหม่ภายหลัง"),
        ).toBeInTheDocument();
        expect(screen.queryByText(/storage|path|key/i)).not.toBeInTheDocument();
    });

    it("revokes private image object URLs when the viewer unmounts", async () => {
        const { unmount } = render(
            <LeaveAttachmentViewerDialog
                open
                attachments={[attachments[0]]}
                onOpenChange={vi.fn()}
            />,
        );
        await screen.findByAltText("ไฟล์แนบคำขอลา รูปที่ 1 จาก 1");

        unmount();

        expect(URL.revokeObjectURL).toHaveBeenCalledWith(
            expect.stringMatching(/^blob:/),
        );
    });

    it("aborts every pending request when the viewer closes", async () => {
        vi.mocked(fetchLeaveAttachmentImage).mockImplementation(
            () => new Promise<Blob>(() => undefined),
        );
        render(
            <ViewerHarness
                initialAttachments={attachments}
                nextAttachments={attachments}
            />,
        );

        await waitFor(() => expect(fetchLeaveAttachmentImage).toHaveBeenCalledTimes(2));
        const signals = vi.mocked(fetchLeaveAttachmentImage).mock.calls.map(([, signal]) => signal);
        fireEvent.click(screen.getByRole("button", { name: "ปิดหน้าต่างไฟล์แนบ" }));

        await waitFor(() => expect(signals.every((signal) => signal?.aborted)).toBe(true));
        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    it("revokes loaded URLs and starts again at image one after reopening", async () => {
        render(
            <ViewerHarness
                initialAttachments={[attachments[0]]}
                nextAttachments={[attachments[0]]}
            />,
        );

        await screen.findByAltText("ไฟล์แนบคำขอลา รูปที่ 1 จาก 1");
        fireEvent.click(screen.getByRole("button", { name: "ปิดหน้าต่างไฟล์แนบ" }));
        await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith(expect.stringMatching(/^blob:/)));

        fireEvent.click(screen.getByText("เปิด viewer"));
        expect(await screen.findByAltText("ไฟล์แนบคำขอลา รูปที่ 1 จาก 1")).toBeInTheDocument();
        expect(fetchLeaveAttachmentImage).toHaveBeenCalledTimes(2);
    });

    it("replaces the resource session when attachment identity changes and ignores late responses", async () => {
        const requestA = createDeferred<Blob>();
        const requestB1 = createDeferred<Blob>();
        const requestB2 = createDeferred<Blob>();
        vi.mocked(fetchLeaveAttachmentImage).mockImplementation((attachmentId) => {
            if (attachmentId === "attachment-a") return requestA.promise;
            if (attachmentId === "attachment-b-1") return requestB1.promise;
            if (attachmentId === "attachment-b-2") return requestB2.promise;
            return Promise.reject(new Error("unexpected attachment"));
        });

        render(
            <ViewerHarness
                initialAttachments={[attachmentA]}
                nextAttachments={attachmentsB}
            />,
        );
        await waitFor(() => expect(fetchLeaveAttachmentImage).toHaveBeenCalledWith("attachment-a", expect.any(AbortSignal)));

        fireEvent.click(screen.getByText("เปลี่ยนชุดไฟล์"));
        await waitFor(() => expect(
            vi.mocked(fetchLeaveAttachmentImage).mock.calls.map(([attachmentId]) => attachmentId),
        ).toEqual(["attachment-a", "attachment-b-1", "attachment-b-2"]));

        expect(vi.mocked(fetchLeaveAttachmentImage).mock.calls[0]?.[1]?.aborted).toBe(true);
        requestA.resolve(new Blob(["stale-a"], { type: "image/webp" }));
        requestB1.resolve(new Blob(["current-b1"], { type: "image/webp" }));
        requestB2.resolve(new Blob(["prefetched-b2"], { type: "image/webp" }));

        await screen.findByAltText("ไฟล์แนบคำขอลา รูปที่ 1 จาก 3");
        expect(screen.queryByAltText("ไฟล์แนบคำขอลา รูปที่ 1 จาก 1")).not.toBeInTheDocument();
        expect(fetchLeaveAttachmentImage).not.toHaveBeenCalledWith("attachment-b-3", expect.anything());
        expect(URL.createObjectURL).toHaveBeenCalledTimes(2);
    });
});
