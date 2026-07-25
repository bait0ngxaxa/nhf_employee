import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LeaveAttachmentViewerDialog } from "@/components/dashboard/leave/_components/LeaveAttachmentViewerDialog";
import { fetchLeaveAttachmentImage } from "@/lib/services/leave/client";
import type { LeaveAttachmentSummary } from "@/lib/types/leave";

vi.mock("@/lib/services/leave/client", () => ({
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
            screen.getByRole("dialog", { name: "หลักฐานประกอบคำขอลา" }),
        ).toBeInTheDocument();
        expect(screen.getByText("กำลังโหลดหลักฐาน…")).toBeInTheDocument();

        expect(
            await screen.findByAltText("หลักฐานประกอบคำขอลา รูปที่ 1 จาก 2"),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: "เปิดหลักฐานในแท็บใหม่" })
                .getAttribute("href"),
        ).toMatch(/^blob:/);
        expect(fetchLeaveAttachmentImage).toHaveBeenCalledWith(
            "attachment-1",
            expect.any(AbortSignal),
        );
        await waitFor(() =>
            expect(screen.queryByText("กำลังโหลดหลักฐาน…")).not.toBeInTheDocument(),
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

        await screen.findByAltText("หลักฐานประกอบคำขอลา รูปที่ 1 จาก 2");
        fireEvent.click(screen.getByRole("button", { name: "ดูรูปถัดไป" }));
        expect(
            await screen.findByAltText("หลักฐานประกอบคำขอลา รูปที่ 2 จาก 2"),
        ).toBeInTheDocument();

        fireEvent.keyDown(document, { key: "ArrowLeft" });
        expect(
            screen.getByAltText("หลักฐานประกอบคำขอลา รูปที่ 1 จาก 2"),
        ).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "ดูหลักฐานรูปที่ 2" }));
        expect(
            screen.getByAltText("หลักฐานประกอบคำขอลา รูปที่ 2 จาก 2"),
        ).toBeInTheDocument();
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
            await screen.findByText("ไม่สามารถเปิดหลักฐานได้ กรุณาลองใหม่ภายหลัง"),
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
        await screen.findByAltText("หลักฐานประกอบคำขอลา รูปที่ 1 จาก 1");

        unmount();

        expect(URL.revokeObjectURL).toHaveBeenCalledWith(
            expect.stringMatching(/^blob:/),
        );
    });
});
