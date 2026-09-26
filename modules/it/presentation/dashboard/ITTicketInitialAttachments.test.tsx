import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ITTicketAttachmentSummary } from "../../contracts";
import { ITTicketInitialAttachments } from "./ITTicketInitialAttachments";

const attachment: ITTicketAttachmentSummary = {
    id: "a".repeat(32),
    originalName: "ภาพประกอบ.png",
    contentType: "image/webp",
    sizeBytes: 1024,
    width: 32,
    height: 24,
    position: 0,
};

const createObjectUrl = vi.fn(() => "blob:private-initial-image");
const revokeObjectUrl = vi.fn();
const originalCreateObjectUrl = URL.createObjectURL;
const originalRevokeObjectUrl = URL.revokeObjectURL;

beforeEach(() => {
    createObjectUrl.mockClear();
    revokeObjectUrl.mockClear();
    Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: createObjectUrl,
        writable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
        configurable: true,
        value: revokeObjectUrl,
        writable: true,
    });
});

afterEach(() => {
    if (originalCreateObjectUrl) {
        Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectUrl });
    } else {
        Reflect.deleteProperty(URL, "createObjectURL");
    }
    if (originalRevokeObjectUrl) {
        Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: originalRevokeObjectUrl });
    } else {
        Reflect.deleteProperty(URL, "revokeObjectURL");
    }
});

describe("IT Ticket initial private image presentation", () => {
    it("shows a loading state while the authenticated Blob request is pending", async () => {
        let resolveBlob: (value: Blob) => void = () => {
            throw new Error("Expected pending image request");
        };
        const pendingBlob = new Promise<Blob>((resolve) => {
            resolveBlob = resolve;
        });
        const loadBlob = vi.fn(() => pendingBlob);

        render(<ITTicketInitialAttachments attachments={[attachment]} loadBlob={loadBlob} />);

        expect(screen.getByRole("status", {
            name: `กำลังโหลดรูปภาพ ${attachment.originalName}`,
        })).toBeInTheDocument();
        await act(async () => resolveBlob(new Blob(["image"], { type: "image/webp" })));
        expect(await screen.findByRole("img", {
            name: `รูปภาพประกอบ: ${attachment.originalName}`,
        })).toBeInTheDocument();
    });

    it("loads through a Blob, retries after failure, and revokes the object URL", async () => {
        const loadBlob = vi.fn()
            .mockRejectedValueOnce(new Error("temporary read failure"))
            .mockResolvedValueOnce(new Blob(["private bytes"], { type: "image/webp" }));
        const view = render(
            <ITTicketInitialAttachments attachments={[attachment]} loadBlob={loadBlob} />,
        );

        expect(await screen.findByRole("alert")).toHaveTextContent("เปิดรูปภาพไม่ได้");
        expect(loadBlob).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole("button", { name: "ลองอีกครั้ง" }));

        const image = await screen.findByRole("img", { name: `รูปภาพประกอบ: ${attachment.originalName}` });
        expect(image).toHaveAttribute("src", "blob:private-initial-image");
        expect(loadBlob).toHaveBeenCalledTimes(2);
        expect(createObjectUrl).toHaveBeenCalledOnce();

        view.unmount();
        expect(revokeObjectUrl).toHaveBeenCalledWith("blob:private-initial-image");
    });

    it("wraps long Thai filenames and omits the evidence section when there are no images", () => {
        const longName = `${"หลักฐานหน้าจอระบบ".repeat(12)}.webp`;
        const longAttachment = { ...attachment, originalName: longName };
        const loadBlob = vi.fn().mockResolvedValue(new Blob(["image"], { type: "image/webp" }));
        const view = render(
            <ITTicketInitialAttachments attachments={[longAttachment]} loadBlob={loadBlob} />,
        );

        expect(screen.getByText(longName)).toHaveClass("break-words");
        view.rerender(<ITTicketInitialAttachments attachments={[]} loadBlob={loadBlob} />);
        expect(screen.queryByRole("region", { name: "รูปภาพประกอบ" })).not.toBeInTheDocument();
    });
});
