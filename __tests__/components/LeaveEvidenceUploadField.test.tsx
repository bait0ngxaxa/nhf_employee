import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LeaveEvidenceUploadField } from "@/components/dashboard/leave/_components/LeaveEvidenceUploadField";

function EvidenceHarness({
    initialAttachments = [],
    disabled = false,
    error = null,
}: {
    initialAttachments?: File[];
    disabled?: boolean;
    error?: string | null;
}) {
    const [attachments, setAttachments] = useState(initialAttachments);

    return (
        <>
            <LeaveEvidenceUploadField
                attachments={attachments}
                attachmentError={error}
                disabled={disabled}
                addAttachments={(files) =>
                    setAttachments((current) => [...current, ...files])
                }
                removeAttachment={(index) =>
                    setAttachments((current) =>
                        current.filter(
                            (_, currentIndex) => currentIndex !== index,
                        ),
                    )
                }
            />
            <button type="button" onClick={() => setAttachments([])}>
                รีเซ็ตไฟล์แนบ
            </button>
        </>
    );
}

describe("LeaveEvidenceUploadField", () => {
    const createObjectURL = vi.fn(
        (file: Blob) => `blob:preview-${file.size}-${createObjectURL.mock.calls.length}`,
    );
    const revokeObjectURL = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(URL, "createObjectURL", {
            configurable: true,
            value: createObjectURL,
        });
        Object.defineProperty(URL, "revokeObjectURL", {
            configurable: true,
            value: revokeObjectURL,
        });
    });

    afterEach(() => {
        Reflect.deleteProperty(URL, "createObjectURL");
        Reflect.deleteProperty(URL, "revokeObjectURL");
    });

    it("selects one image and shows its preview, name, size, and count", async () => {
        render(<EvidenceHarness />);
        const file = new File([new Uint8Array(1536)], "proof.jpg", {
            type: "image/jpeg",
        });

        fireEvent.change(
            screen.getByLabelText("เลือกไฟล์รูปภาพประกอบคำขอลา"),
            { target: { files: [file] } },
        );

        expect(
            await screen.findByAltText("ตัวอย่างรูปภาพ proof.jpg"),
        ).toBeInTheDocument();
        expect(screen.getByText("proof.jpg")).toBeInTheDocument();
        expect(screen.getByText("2 KB")).toBeInTheDocument();
        expect(screen.getByText("1/3 ไฟล์")).toBeInTheDocument();
        expect(createObjectURL).toHaveBeenCalledTimes(1);
    });

    it("selects multiple images in one action", async () => {
        render(<EvidenceHarness />);
        const files = [
            new File(["first"], "first.jpg", { type: "image/jpeg" }),
            new File(["second"], "second.png", { type: "image/png" }),
        ];

        fireEvent.change(
            screen.getByLabelText("เลือกไฟล์รูปภาพประกอบคำขอลา"),
            { target: { files } },
        );

        expect(
            await screen.findByAltText("ตัวอย่างรูปภาพ first.jpg"),
        ).toBeInTheDocument();
        expect(
            screen.getByAltText("ตัวอย่างรูปภาพ second.png"),
        ).toBeInTheDocument();
        expect(screen.getByText("2/3 ไฟล์")).toBeInTheDocument();
    });

    it("removes an image and revokes only its object URL", async () => {
        const file = new File(["image"], "proof.webp", {
            type: "image/webp",
        });
        render(<EvidenceHarness initialAttachments={[file]} />);
        await screen.findByAltText("ตัวอย่างรูปภาพ proof.webp");

        fireEvent.click(
            screen.getByRole("button", {
                name: "ลบไฟล์แนบ proof.webp",
            }),
        );

        await waitFor(() =>
            expect(
                screen.queryByAltText("ตัวอย่างรูปภาพ proof.webp"),
            ).not.toBeInTheDocument(),
        );
        expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    });

    it("revokes object URLs when attachments reset and on unmount", async () => {
        const files = [
            new File(["first"], "first.jpg", { type: "image/jpeg" }),
            new File(["second"], "second.png", { type: "image/png" }),
        ];
        const { unmount } = render(
            <EvidenceHarness initialAttachments={files} />,
        );
        await screen.findByAltText("ตัวอย่างรูปภาพ first.jpg");

        fireEvent.click(
            screen.getByRole("button", { name: "รีเซ็ตไฟล์แนบ" }),
        );

        await waitFor(() =>
            expect(revokeObjectURL).toHaveBeenCalledTimes(2),
        );

        fireEvent.change(
            screen.getByLabelText("เลือกไฟล์รูปภาพประกอบคำขอลา"),
            {
                target: {
                    files: [
                        new File(["third"], "third.webp", {
                            type: "image/webp",
                        }),
                    ],
                },
            },
        );
        await screen.findByAltText("ตัวอย่างรูปภาพ third.webp");
        unmount();

        expect(revokeObjectURL).toHaveBeenCalledTimes(3);
    });

    it("announces validation errors and disables controls during submit", async () => {
        const file = new File(["image"], "proof.jpg", {
            type: "image/jpeg",
        });
        render(
            <EvidenceHarness
                initialAttachments={[file]}
                disabled
                error="แนบไฟล์ได้สูงสุด 3 ไฟล์"
            />,
        );
        await screen.findByAltText("ตัวอย่างรูปภาพ proof.jpg");

        expect(screen.getByRole("alert")).toHaveTextContent(
            "แนบไฟล์ได้สูงสุด 3 ไฟล์",
        );
        expect(
            screen.getByLabelText("เลือกไฟล์รูปภาพประกอบคำขอลา"),
        ).toBeDisabled();
        expect(
            screen.getByRole("button", { name: "เพิ่มรูปภาพ" }),
        ).toBeDisabled();
        expect(
            screen.getByRole("button", { name: "ลบไฟล์แนบ proof.jpg" }),
        ).toBeDisabled();
    });

    it("explains that evidence is optional private information", () => {
        render(<EvidenceHarness />);
        const input = screen.getByLabelText("เลือกไฟล์รูปภาพประกอบคำขอลา");

        expect(screen.getByText(/ไม่บังคับ/)).toBeInTheDocument();
        expect(input).toHaveAttribute(
            "accept",
            "image/jpeg,image/png,image/webp",
        );
        expect(input).toHaveAttribute("multiple");
        expect(
            screen.getByText(
                "ไฟล์แนบเป็นข้อมูลส่วนบุคคลและใช้ประกอบการพิจารณาคำขอลาเท่านั้น",
            ),
        ).toBeInTheDocument();
    });
});
