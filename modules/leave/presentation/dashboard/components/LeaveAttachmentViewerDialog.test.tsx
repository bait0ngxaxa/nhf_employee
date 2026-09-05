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
});
