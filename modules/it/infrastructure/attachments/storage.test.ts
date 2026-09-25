import { createHash } from "node:crypto";
import { lstat, mkdtemp, readdir, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";

import {
    IT_TICKET_ATTACHMENT_MAX_BYTES,
    IT_TICKET_ATTACHMENT_MAX_FILES,
    IT_TICKET_ATTACHMENT_MAX_INPUT_PIXELS,
    IT_TICKET_ATTACHMENT_MAX_TOTAL_BYTES,
} from "../../contracts";
import {
    assertValidITTicketDecodedImage,
    ITTicketAttachmentValidationError,
    prepareITTicketAttachments,
    sanitizeITTicketAttachmentName,
    type ITTicketAttachmentSource,
} from "./validation";
import {
    createITTicketAttachmentStorage,
    resolveITAttachmentPath,
} from "./storage";

const temporaryRoots: string[] = [];

afterEach(async () => {
    await Promise.all(temporaryRoots.splice(0).map((directory) =>
        rm(directory, { recursive: true, force: true }),
    ));
});

async function createRaster(width = 16, height = 12): Promise<Buffer> {
    return sharp({
        create: { width, height, channels: 3, background: { r: 42, g: 82, b: 125 } },
    }).png().toBuffer();
}

function source(
    name: string,
    type: string,
    bytes: Buffer,
    size = bytes.byteLength,
): ITTicketAttachmentSource {
    return {
        name,
        type,
        size,
        arrayBuffer: async () => Uint8Array.from(bytes).buffer,
    };
}

async function tempDirectory(): Promise<string> {
    const directory = await mkdtemp(path.join(os.tmpdir(), "it-ticket-attachment-"));
    temporaryRoots.push(directory);
    return directory;
}

describe("IT private Ticket attachment validation", () => {
    it("accepts real JPEG, PNG, and WEBP images and normalizes each to WEBP", async () => {
        const raster = await createRaster();
        const [jpeg, png, webp] = await Promise.all([
            sharp(raster).jpeg().toBuffer(),
            sharp(raster).png().toBuffer(),
            sharp(raster).webp().toBuffer(),
        ]);
        const prepared = await prepareITTicketAttachments([
            source("ภาพ.jpg", "image/jpeg", jpeg),
            source("ภาพ.png", "image/png", png),
            source("ภาพ.webp", "image/webp", webp),
        ]);

        expect(prepared).toHaveLength(3);
        for (const attachment of prepared) {
            expect(attachment.contentType).toBe("image/webp");
            expect((await sharp(attachment.data).metadata()).format).toBe("webp");
            expect(attachment.contentSha256).toBe(
                createHash("sha256").update(attachment.data).digest("hex"),
            );
            expect(attachment.sizeBytes).toBe(attachment.data.byteLength);
        }
    });

    it("honors EXIF orientation, caps large images, and does not enlarge small images", async () => {
        const orientedSource = await sharp({
            create: { width: 3000, height: 1000, channels: 3, background: "white" },
        }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
        const [oriented] = await prepareITTicketAttachments([
            source("oriented.jpg", "image/jpeg", orientedSource),
        ]);
        expect(oriented).toMatchObject({ width: 800, height: 2400 });

        const smallSource = await createRaster(10, 20);
        const [small] = await prepareITTicketAttachments([
            source("small.png", "image/png", smallSource),
        ]);
        expect(small).toMatchObject({ width: 10, height: 20 });
    });

    it("rejects corrupt or MIME-spoofed bytes and unsupported file types", async () => {
        await expect(prepareITTicketAttachments([
            source("broken.jpg", "image/jpeg", Buffer.from("not an image")),
        ])).rejects.toBeInstanceOf(ITTicketAttachmentValidationError);
        await expect(prepareITTicketAttachments([
            source("spoofed.png", "image/png", await sharp(await createRaster()).jpeg().toBuffer()),
        ])).rejects.toBeInstanceOf(ITTicketAttachmentValidationError);
        await expect(prepareITTicketAttachments([
            source("report.pdf", "application/pdf", Buffer.from("%PDF-")),
        ])).rejects.toBeInstanceOf(ITTicketAttachmentValidationError);
    });

    it("rejects invalid dimensions, over-limit file count, and source byte limits before decoding", async () => {
        expect(() => assertValidITTicketDecodedImage(
            "jpeg",
            IT_TICKET_ATTACHMENT_MAX_INPUT_PIXELS + 1,
            1,
            "image/jpeg",
        )).toThrow(ITTicketAttachmentValidationError);
        expect(() => assertValidITTicketDecodedImage("jpeg", 0, 10, "image/jpeg"))
            .toThrow(ITTicketAttachmentValidationError);

        const placeholder = source("large.jpg", "image/jpeg", Buffer.alloc(0), IT_TICKET_ATTACHMENT_MAX_BYTES + 1);
        await expect(prepareITTicketAttachments(
            Array.from({ length: IT_TICKET_ATTACHMENT_MAX_FILES + 1 }, () => placeholder),
        )).rejects.toBeInstanceOf(ITTicketAttachmentValidationError);
        await expect(prepareITTicketAttachments([placeholder]))
            .rejects.toBeInstanceOf(ITTicketAttachmentValidationError);

        const eachWithinLimit = Math.floor(IT_TICKET_ATTACHMENT_MAX_TOTAL_BYTES / 3) + 1;
        const largeSet = Array.from({ length: 3 }, (_, index) =>
            source(`image-${index}.jpg`, "image/jpeg", Buffer.alloc(0), eachWithinLimit),
        );
        await expect(prepareITTicketAttachments(largeSet))
            .rejects.toBeInstanceOf(ITTicketAttachmentValidationError);
    });

    it("sanitizes path-like names while preserving Thai and rejects empty or overlong names", () => {
        expect(sanitizeITTicketAttachmentName("หลักฐาน\u0000.png")).toBe("หลักฐาน.png");
        expect(sanitizeITTicketAttachmentName("หลักฐาน\u0085.png")).toBe("หลักฐาน.png");
        expect(sanitizeITTicketAttachmentName("../folder\\ภาพ.jpg")).toBe("__folder_ภาพ.jpg");
        expect(() => sanitizeITTicketAttachmentName("   ")).toThrow(ITTicketAttachmentValidationError);
        expect(() => sanitizeITTicketAttachmentName(`${"ก".repeat(256)}.jpg`))
            .toThrow(ITTicketAttachmentValidationError);
    });
});

describe("IT private Ticket attachment storage", () => {
    it("uses random contained storage keys, exclusive files, and restrictive modes", async () => {
        const root = await tempDirectory();
        const storage = createITTicketAttachmentStorage(root);
        const prepared = await prepareITTicketAttachments([
            source("ชื่อแสดง.png", "image/png", await createRaster()),
        ]);
        const [first] = await storage.write(19, prepared);
        const [second] = await storage.write(19, prepared);
        expect(first.storageKey).toMatch(/^it\/19\/[a-f0-9]{32}\.webp$/);
        expect(second.storageKey).not.toBe(first.storageKey);
        expect(first.originalName).toBe("ชื่อแสดง.png");
        expect(resolveITAttachmentPath(root, first.storageKey)).toContain(path.join("it", "19"));
        await expect(storage.read(first.storageKey, 20)).rejects.toThrow();
        await expect(storage.read("it/19/../../outside.webp", 19)).rejects.toThrow();
        await expect(storage.read(first.storageKey, 19)).resolves.toEqual(prepared[0]?.data);

        const targetDirectory = path.join(root, "it", "19");
        expect((await lstat(targetDirectory)).isDirectory()).toBe(true);
        if (process.platform !== "win32") {
            expect((await stat(targetDirectory)).mode & 0o777).toBe(0o750);
        }
        const fileStat = await lstat(resolveITAttachmentPath(root, first.storageKey));
        if (process.platform !== "win32") expect(fileStat.mode & 0o777).toBe(0o640);
        await expect(readdir(targetDirectory)).resolves.toHaveLength(2);
    });

    it("cleans files already created when a later exclusive write fails", async () => {
        const root = await tempDirectory();
        const storage = createITTicketAttachmentStorage(root);
        const [prepared] = await prepareITTicketAttachments([
            source("proof.png", "image/png", await createRaster()),
        ]);
        const invalidPrepared = {
            ...prepared,
            data: null as unknown as Buffer,
        };
        await expect(storage.write(21, [prepared, invalidPrepared])).rejects.toThrow();
        await expect(storage.listCandidates()).resolves.toEqual([]);
    });
});
