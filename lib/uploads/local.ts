import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import {
    IMAGE_UPLOAD_ACCEPTED_TYPES,
    IMAGE_UPLOAD_MAX_BYTES,
} from "@/lib/ssot/uploads";

const UPLOAD_ROOT = path.join(process.cwd(), ".uploads");
const MAX_DIMENSION = 1600;
const WEBP_QUALITY = 80;

const SCOPE_SEGMENTS = {
    item: ["stock", "items"],
    variant: ["stock", "variants"],
} as const;

type UploadScope = keyof typeof SCOPE_SEGMENTS;

function isAllowedImageType(contentType: string): boolean {
    return IMAGE_UPLOAD_ACCEPTED_TYPES.includes(
        contentType as (typeof IMAGE_UPLOAD_ACCEPTED_TYPES)[number],
    );
}

function createUploadName(scope: UploadScope): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(6).toString("hex");
    return `${scope}-${timestamp}-${random}.webp`;
}

function createRelativeSegments(scope: UploadScope): string[] {
    const now = new Date();
    return [
        ...SCOPE_SEGMENTS[scope],
        String(now.getFullYear()),
        String(now.getMonth() + 1).padStart(2, "0"),
    ];
}

export function resolveUploadPath(segments: string[]): string {
    const resolvedPath = path.resolve(UPLOAD_ROOT, ...segments);
    const rootPath = path.resolve(UPLOAD_ROOT);

    if (resolvedPath !== rootPath && !resolvedPath.startsWith(`${rootPath}${path.sep}`)) {
        throw new Error("Invalid upload path");
    }

    return resolvedPath;
}

export function isManagedUploadUrl(url: string | null | undefined): url is string {
    return typeof url === "string" && url.startsWith("/api/uploads/");
}

function getRelativeSegmentsFromUrl(url: string): string[] {
    return url.replace("/api/uploads/", "").split("/").filter(Boolean);
}

export async function saveLocalImageUpload(input: {
    scope: UploadScope;
    file: File;
}): Promise<{
    url: string;
    relativePath: string;
    contentType: "image/webp";
    size: number;
    width: number;
    height: number;
}> {
    const { file, scope } = input;

    if (!isAllowedImageType(file.type)) {
        throw new Error("รองรับเฉพาะไฟล์ JPG, PNG และ WEBP");
    }

    if (file.size > IMAGE_UPLOAD_MAX_BYTES) {
        throw new Error("ไฟล์รูปต้องมีขนาดไม่เกิน 8MB");
    }

    const sourceBuffer = Buffer.from(await file.arrayBuffer());
    const transformed = await sharp(sourceBuffer)
        .rotate()
        .resize(MAX_DIMENSION, MAX_DIMENSION, {
            fit: "inside",
            withoutEnlargement: true,
        })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer({ resolveWithObject: true });

    const relativeSegments = [...createRelativeSegments(scope), createUploadName(scope)];
    const relativePath = relativeSegments.join("/");
    const targetPath = resolveUploadPath(relativeSegments);
    const targetDirectory = path.dirname(targetPath);

    await mkdir(targetDirectory, { recursive: true });
    await writeFile(targetPath, transformed.data);

    return {
        url: `/api/uploads/${relativePath}`,
        relativePath,
        contentType: "image/webp",
        size: transformed.info.size,
        width: transformed.info.width ?? 0,
        height: transformed.info.height ?? 0,
    };
}

export async function readLocalUpload(segments: string[]): Promise<Buffer> {
    return readFile(resolveUploadPath(segments));
}

export async function deleteLocalUploadByUrl(url: string): Promise<void> {
    if (!isManagedUploadUrl(url)) {
        return;
    }

    const filePath = resolveUploadPath(getRelativeSegmentsFromUrl(url));
    await rm(filePath, { force: true });
}
