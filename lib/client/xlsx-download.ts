"use client";

import { fetchWithRefresh } from "@/modules/auth/client";
import { triggerDownload } from "@/lib/helpers/download";

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DEFAULT_ERROR = "ไม่สามารถดาวน์โหลดไฟล์ได้ กรุณาลองใหม่อีกครั้ง";
const DOWNLOAD_TIMEOUT_MS = 120_000;
const TIMEOUT_ERROR = "การดาวน์โหลดใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง";
const pendingDownloads = new Map<string, Promise<void>>();

class XlsxDownloadError extends Error {}

function safeFilename(value: string): boolean {
    return value.length > 5 && value.length <= 200
        && value === value.trim() && !value.startsWith(".")
        && /\.xlsx$/i.test(value)
        && !/[<>:"/\\|?*\p{Cc}\p{Cf}]/u.test(value)
        && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(value);
}

function resolveFilename(response: Response, fallback: string): string {
    const safeFallback = safeFilename(fallback) ? fallback : "export.xlsx";
    const encoded = response.headers.get("Content-Disposition")
        ?.match(/(?:^|;)\s*filename\*=UTF-8''([^;]*)/i)?.[1]?.trim();
    if (!encoded) return safeFallback;
    try {
        const filename = decodeURIComponent(encoded);
        return safeFilename(filename) ? filename : safeFallback;
    } catch {
        return safeFallback;
    }
}

async function responseError(response: Response): Promise<string> {
    const body: unknown = await response.json().catch(() => null);
    if (body && typeof body === "object" && "error" in body
        && typeof body.error === "string") {
        const message = body.error.trim();
        // Application JSON errors are already sanitized by the server; reject malformed payloads.
        if (message && message.length <= 500 && !/[<>\p{Cc}]/u.test(message)) return message;
    }
    return DEFAULT_ERROR;
}

async function performDownload(url: string, fallbackFilename: string, signal: AbortSignal): Promise<void> {
    try {
        const response = await fetchWithRefresh(url, { credentials: "include", cache: "no-store", signal });
        if (signal.aborted) throw new XlsxDownloadError(TIMEOUT_ERROR);
        if (!response.ok) throw new XlsxDownloadError(await responseError(response));
        if (response.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() !== XLSX_CONTENT_TYPE) {
            throw new XlsxDownloadError(DEFAULT_ERROR);
        }
        const blob = await response.blob();
        if (signal.aborted) throw new XlsxDownloadError(TIMEOUT_ERROR);
        const objectUrl = URL.createObjectURL(blob);
        try {
            triggerDownload(objectUrl, resolveFilename(response, fallbackFilename));
        } catch (error) {
            URL.revokeObjectURL(objectUrl);
            throw error;
        }
        // Only resource cleanup is deferred; callers finish when the browser download starts.
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (error) {
        if (error instanceof XlsxDownloadError) throw error;
        throw new XlsxDownloadError(DEFAULT_ERROR);
    }
}

/** Coalesce overlapping requests for the same XLSX URL; feature controls own their UI locks. */
export function downloadXlsx(url: string, fallbackFilename = "export.xlsx"): Promise<void> {
    const pending = pendingDownloads.get(url);
    if (pending) return pending;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
        timeout = setTimeout(() => {
            reject(new XlsxDownloadError(TIMEOUT_ERROR));
            controller.abort();
        }, DOWNLOAD_TIMEOUT_MS);
    });
    // Refresh waits or transports that ignore abort must not retain the shared lock.
    const download = Promise.race([
        performDownload(url, fallbackFilename, controller.signal),
        deadline,
    ]).finally(() => {
        clearTimeout(timeout);
        pendingDownloads.delete(url);
    });
    pendingDownloads.set(url, download);
    return download;
}
