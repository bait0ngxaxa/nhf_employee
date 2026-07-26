import { mkdtemp, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    createLeaveAttachmentStorage,
    type LeaveAttachmentSource,
} from "@/lib/uploads/leave";
import {
    LEAVE_ATTACHMENT_MAX_BYTES,
    LEAVE_ATTACHMENT_MAX_FILES,
    LEAVE_ATTACHMENT_MAX_INPUT_PIXELS,
} from "@/lib/ssot/leave-attachments";

function createFile(
    name: string,
    type: string,
    buffer: Buffer,
    size: number = buffer.byteLength,
): LeaveAttachmentSource {
    return {
        name,
        type,
        size,
        async arrayBuffer(): Promise<ArrayBuffer> {
            return Uint8Array.from(buffer).buffer;
        },
    };
}

async function createImage(
    format: "jpeg" | "png" | "webp" | "gif" | "tiff",
): Promise<Buffer> {
    const image = sharp({
        create: {
            width: 32,
            height: 24,
            channels: 3,
            background: { r: 30, g: 120, b: 210 },
        },
    });

    return image[format]().toBuffer();
}

async function createCompressedImageWithDimensions(
    width: number,
    height: number,
): Promise<Buffer> {
    const source = await createImage("jpeg");
    const markerIndex = source.findIndex(
        (byte, index) => byte === 0xff && source[index + 1] === 0xc0,
    );

    if (markerIndex < 0) {
        throw new Error("JPEG SOF marker not found");
    }

    const image = Buffer.from(source);
    image.writeUInt16BE(height, markerIndex + 5);
    image.writeUInt16BE(width, markerIndex + 7);
    return image;
}

describe("private leave attachment storage", () => {
    let storageRoot: string;

    beforeEach(async () => {
        storageRoot = await mkdtemp(path.join(tmpdir(), "leave-attachments-"));
    });

    afterEach(async () => {
        await rm(storageRoot, { recursive: true, force: true });
    });

    it.each([
        ["JPG", "jpeg", "image/jpeg"],
        ["PNG", "png", "image/png"],
        ["WEBP", "webp", "image/webp"],
    ] as const)("stores a valid %s file as private WebP", async (_label, format, mimeType) => {
        const source = await createImage(format);
        const storage = createLeaveAttachmentStorage(storageRoot);

        const [stored] = await storage.save({
            leaveRequestId: "leave-request-1",
            files: [createFile(`proof.${format}`, mimeType, source)],
        });

        expect(stored).toMatchObject({
            originalName: `proof.${format}`,
            contentType: "image/webp",
            width: 32,
            height: 24,
        });
        expect(stored?.storageKey).toMatch(
            /^leave\/leave-request-1\/[a-f0-9]{32}\.webp$/,
        );
        expect(stored?.storageKey).not.toContain(`proof.${format}`);

        const savedBuffer = await storage.read(stored?.storageKey ?? "");
        const metadata = await sharp(savedBuffer).metadata();
        expect(metadata.format).toBe("webp");
        expect(stored?.sizeBytes).toBe(savedBuffer.byteLength);
        expect(stored?.contentSha256).toBe(
            createHash("sha256").update(savedBuffer).digest("hex"),
        );
    });

    it("rejects an unsupported MIME type", async () => {
        const storage = createLeaveAttachmentStorage(storageRoot);
        const source = await createImage("png");

        await expect(
            storage.save({
                leaveRequestId: "leave-request-1",
                files: [createFile("proof.gif", "image/gif", source)],
            }),
        ).rejects.toThrow("รองรับเฉพาะไฟล์ JPG, PNG และ WEBP");
    });

    it.each([
        ["GIF", "gif", "image/jpeg", "fake.gif"],
        ["SVG", "svg", "image/png", "fake.svg"],
        ["TIFF", "tiff", "image/webp", "fake.tiff"],
    ] as const)(
        "rejects a %s file when the declared MIME type is allowed",
        async (_label, actualFormat, declaredType, name) => {
            const storage = createLeaveAttachmentStorage(storageRoot);
            const source =
                actualFormat === "svg"
                    ? Buffer.from(
                          '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="24"><rect width="32" height="24" fill="blue"/></svg>',
                          "utf8",
                      )
                    : await createImage(actualFormat);

            await expect(
                storage.save({
                    leaveRequestId: "leave-request-1",
                    files: [createFile(name, declaredType, source)],
                }),
            ).rejects.toThrow(`ไฟล์ "${name}" ต้องเป็น JPG, PNG หรือ WEBP`);
        },
    );

    it("rejects a file larger than the per-file limit", async () => {
        const storage = createLeaveAttachmentStorage(storageRoot);
        const source = await createImage("jpeg");

        await expect(
            storage.save({
                leaveRequestId: "leave-request-1",
                files: [
                    createFile(
                        "large.jpg",
                        "image/jpeg",
                        source,
                        LEAVE_ATTACHMENT_MAX_BYTES + 1,
                    ),
                ],
            }),
        ).rejects.toThrow("ไฟล์รูปภาพแต่ละไฟล์ต้องมีขนาดไม่เกิน 8 MB");
    });

    it("rejects more files than the request limit", async () => {
        const storage = createLeaveAttachmentStorage(storageRoot);
        const source = await createImage("png");
        const files = Array.from(
            { length: LEAVE_ATTACHMENT_MAX_FILES + 1 },
            (_, index) => createFile(`proof-${index}.png`, "image/png", source),
        );

        await expect(
            storage.save({ leaveRequestId: "leave-request-1", files }),
        ).rejects.toThrow("แนบไฟล์ได้สูงสุด 3 ไฟล์");
    });

    it("rejects files whose combined size exceeds the request limit", async () => {
        const storage = createLeaveAttachmentStorage(storageRoot);
        const source = await createImage("webp");
        const sevenMegabytes = 7 * 1024 * 1024;
        const files = Array.from({ length: 3 }, (_, index) =>
            createFile(`proof-${index}.webp`, "image/webp", source, sevenMegabytes),
        );

        await expect(
            storage.save({ leaveRequestId: "leave-request-1", files }),
        ).rejects.toThrow("ไฟล์รูปภาพรวมต้องมีขนาดไม่เกิน 20 MB");
    });

    it("rejects a declared image that Sharp cannot decode", async () => {
        const storage = createLeaveAttachmentStorage(storageRoot);
        const invalidImage = Buffer.from("not an image", "utf8");

        await expect(
            storage.save({
                leaveRequestId: "leave-request-1",
                files: [createFile("invalid.jpg", "image/jpeg", invalidImage)],
            }),
        ).rejects.toThrow('ไฟล์ "invalid.jpg" ไม่ใช่รูปภาพที่ถูกต้อง');
    });

    it("rejects compressed images that exceed the input pixel limit", async () => {
        const storage = createLeaveAttachmentStorage(storageRoot);
        const width = 6401;
        const height = Math.ceil(LEAVE_ATTACHMENT_MAX_INPUT_PIXELS / width);
        const oversizedImage = await createCompressedImageWithDimensions(
            width,
            height,
        );

        expect(oversizedImage.byteLength).toBeLessThan(LEAVE_ATTACHMENT_MAX_BYTES);
        await expect(
            storage.save({
                leaveRequestId: "leave-request-1",
                files: [createFile("oversized.jpg", "image/jpeg", oversizedImage)],
            }),
        ).rejects.toThrow('ไฟล์ "oversized.jpg" มีความละเอียดสูงเกินไป');
    });

    it("rejects path traversal in leave request IDs and storage keys", async () => {
        const storage = createLeaveAttachmentStorage(storageRoot);
        const source = await createImage("png");

        await expect(
            storage.save({
                leaveRequestId: "../outside",
                files: [createFile("proof.png", "image/png", source)],
            }),
        ).rejects.toThrow("รหัสคำขอลาไม่ถูกต้อง");
        await expect(storage.read("../outside.webp")).rejects.toThrow(
            "รหัสจัดเก็บไฟล์ไม่ถูกต้อง",
        );
    });

    it("deletes a stored file", async () => {
        const storage = createLeaveAttachmentStorage(storageRoot);
        const source = await createImage("jpeg");
        const [stored] = await storage.save({
            leaveRequestId: "leave-request-1",
            files: [createFile("proof.jpg", "image/jpeg", source)],
        });
        const storageKey = stored?.storageKey ?? "";

        await expect(storage.read(storageKey)).resolves.toBeInstanceOf(Buffer);
        await storage.delete(storageKey);
        await expect(storage.read(storageKey)).rejects.toMatchObject({
            code: "ENOENT",
        });
    });
});
