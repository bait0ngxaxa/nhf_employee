import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadXlsx } from "@/lib/client/xlsx-download";
import { fetchWithRefresh } from "@/modules/auth/client";
import { triggerDownload } from "@/lib/helpers/download";

vi.mock("@/modules/auth/client", () => ({ fetchWithRefresh: vi.fn() }));
vi.mock("@/lib/helpers/download", () => ({ triggerDownload: vi.fn() }));

const mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const fallbackError = "ไม่สามารถดาวน์โหลดไฟล์ได้ กรุณาลองใหม่อีกครั้ง";
const createObjectURL = vi.fn(() => "blob:xlsx");
const revokeObjectURL = vi.fn();

function response(filename?: string): Response {
    return new Response("xlsx bytes", { headers: {
        "Content-Type": `${mime}; charset=utf-8`,
        ...(filename === undefined ? {} : { "Content-Disposition": `attachment; filename*=UTF-8''${filename}` }),
    } });
}

describe("XLSX download", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.useFakeTimers();
        createObjectURL.mockReturnValue("blob:xlsx");
        vi.stubGlobal("URL", class extends URL {
            static createObjectURL = createObjectURL;
            static revokeObjectURL = revokeObjectURL;
        });
        vi.mocked(fetchWithRefresh).mockResolvedValue(response());
    });
    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("downloads with UTF-8 filename and defers only URL cleanup", async () => {
        const filename = "รายงาน_ค้นหา-สมชาย.xlsx";
        vi.mocked(fetchWithRefresh).mockResolvedValue(response(encodeURIComponent(filename)));
        await downloadXlsx("/api/export");
        expect(fetchWithRefresh).toHaveBeenCalledWith("/api/export", { credentials: "include", cache: "no-store", signal: expect.any(AbortSignal) });
        expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
        expect(triggerDownload).toHaveBeenCalledWith("blob:xlsx", filename);
        expect(revokeObjectURL).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(1); // URL cleanup only; request deadline is cleared.
        await vi.advanceTimersByTimeAsync(60_000);
        expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:xlsx");
    });

    it.each([undefined, "", "%INVALID", "report.csv", "report.xlsx.exe", "../report.xlsx", "C:\\report.xlsx", "a/b.xlsx", "a:b.xlsx", "a?b.xlsx", "CON.xlsx", ".hidden.xlsx", "a\u202eb.xlsx", "a\nb.xlsx", "x".repeat(201) + ".xlsx"])(
        "uses a safe fallback for filename %s", async (filename) => {
            vi.mocked(fetchWithRefresh).mockResolvedValue(response(filename === "%INVALID" ? filename : filename === undefined ? undefined : encodeURIComponent(filename)));
            await downloadXlsx("/api/export", "รายงาน.xlsx");
            expect(triggerDownload).toHaveBeenCalledWith("blob:xlsx", "รายงาน.xlsx");
        },
    );

    it("validates the fallback too", async () => {
        await downloadXlsx("/api/export", "../unsafe.exe");
        expect(triggerDownload).toHaveBeenCalledWith("blob:xlsx", "export.xlsx");
    });

    it.each([400, 401, 403, 500])("propagates application error for HTTP %i and permits retry", async (status) => {
        vi.mocked(fetchWithRefresh).mockResolvedValueOnce(Response.json({ error: "ไม่มีสิทธิ์ดาวน์โหลด" }, { status }));
        await expect(downloadXlsx("/api/export")).rejects.toThrow("ไม่มีสิทธิ์ดาวน์โหลด");
        expect(triggerDownload).not.toHaveBeenCalled();
        await downloadXlsx("/api/export");
        expect(fetchWithRefresh).toHaveBeenCalledTimes(2);
    });

    it.each(["non-JSON", "invalid error", "HTML", "network", "body"])("handles %s failures safely", async (failure) => {
        if (failure === "network") {
            vi.mocked(fetchWithRefresh).mockRejectedValueOnce(new Error("sensitive transport details"));
        } else {
            const result = failure === "invalid error"
                ? Response.json({ error: { stack: "private" } }, { status: 500 })
                : new Response("<html>Error</html>", { status: failure === "non-JSON" ? 500 : 200,
                    headers: { "Content-Type": failure === "body" ? mime : "text/html" } });
            if (failure === "body") vi.spyOn(result, "blob").mockRejectedValue(new Error("truncated"));
            vi.mocked(fetchWithRefresh).mockResolvedValueOnce(result);
        }
        await expect(downloadXlsx("/api/export")).rejects.toThrow(fallbackError);
        expect(createObjectURL).not.toHaveBeenCalled();
        expect(triggerDownload).not.toHaveBeenCalled();
    });

    it("cleans up immediately if download initiation fails", async () => {
        vi.mocked(triggerDownload).mockImplementationOnce(() => { throw new Error("DOM failure"); });
        await expect(downloadXlsx("/api/export")).rejects.toThrow(fallbackError);
        expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:xlsx");
        expect(vi.getTimerCount()).toBe(0);
    });

    it("coalesces requests until the entire body arrives, then permits another download", async () => {
        let finish: (blob: Blob) => void = () => { throw new Error("Missing resolver"); };
        const body = new Promise<Blob>((resolve) => { finish = resolve; });
        const result = response();
        vi.spyOn(result, "blob").mockReturnValue(body);
        vi.mocked(fetchWithRefresh).mockResolvedValueOnce(result);
        const first = downloadXlsx("/api/export");
        const second = downloadXlsx("/api/export");
        expect(second).toBe(first);
        await Promise.resolve();
        expect(fetchWithRefresh).toHaveBeenCalledTimes(1);
        expect(triggerDownload).not.toHaveBeenCalled();
        finish(new Blob(["complete workbook"]));
        await first;
        await downloadXlsx("/api/export");
        expect(fetchWithRefresh).toHaveBeenCalledTimes(2);
        expect(triggerDownload).toHaveBeenCalledTimes(2);
    });

    it.each(["fetch", "body", "error body"])("times out a stalled %s and permits retry without a late download", async (stage) => {
        const url = `/api/export?stage=${stage}`;
        let finishFetch: ((value: Response) => void) | undefined;
        let finishBody: ((value: Blob) => void) | undefined;
        let finishError: ((value: unknown) => void) | undefined;
        if (stage === "fetch") {
            vi.mocked(fetchWithRefresh).mockReturnValueOnce(new Promise<Response>((resolve) => { finishFetch = resolve; }));
        } else {
            const result = stage === "body" ? response() : Response.json({ error: "failed" }, { status: 500 });
            if (stage === "body") {
                vi.spyOn(result, "blob").mockReturnValue(new Promise<Blob>((resolve) => { finishBody = resolve; }));
            } else {
                vi.spyOn(result, "json").mockReturnValue(new Promise<unknown>((resolve) => { finishError = resolve; }));
            }
            vi.mocked(fetchWithRefresh).mockResolvedValueOnce(result);
        }
        const first = downloadXlsx(url);
        expect(downloadXlsx(url)).toBe(first);
        let failure: unknown;
        const settled = first.catch((error: unknown) => { failure = error; });
        await vi.advanceTimersByTimeAsync(120_000);
        expect(failure).toBeInstanceOf(Error);
        expect(failure).toMatchObject({ message: "การดาวน์โหลดใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง" });
        await settled;
        const signal = vi.mocked(fetchWithRefresh).mock.calls[0]?.[1]?.signal;
        expect(signal?.aborted).toBe(true);
        expect(triggerDownload).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);

        // Start a replacement while the old transport still ignores cancellation.
        let finishRetry: ((value: Response) => void) | undefined;
        vi.mocked(fetchWithRefresh).mockReturnValueOnce(new Promise<Response>((resolve) => { finishRetry = resolve; }));
        const retry = downloadXlsx(url);
        expect(retry).not.toBe(first);
        finishFetch?.(response());
        finishBody?.(new Blob(["late workbook"]));
        finishError?.({ error: "late error" });
        await vi.advanceTimersByTimeAsync(0);
        expect(triggerDownload).not.toHaveBeenCalled();
        expect(createObjectURL).not.toHaveBeenCalled();
        expect(downloadXlsx(url)).toBe(retry);
        finishRetry?.(response());
        await retry;
        expect(fetchWithRefresh).toHaveBeenCalledTimes(2);
        expect(triggerDownload).toHaveBeenCalledTimes(1);
    });

    it("uses one deadline for the request and body rather than resetting after headers", async () => {
        let finishFetch: ((value: Response) => void) | undefined;
        vi.mocked(fetchWithRefresh).mockReturnValueOnce(new Promise<Response>((resolve) => { finishFetch = resolve; }));
        const result = response();
        vi.spyOn(result, "blob").mockReturnValue(new Promise<Blob>(() => undefined));
        const download = downloadXlsx("/api/export");
        const rejected = expect(download).rejects.toThrow("การดาวน์โหลดใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง");
        await vi.advanceTimersByTimeAsync(100_000);
        finishFetch?.(result);
        await vi.advanceTimersByTimeAsync(20_000);
        await rejected;
        expect(triggerDownload).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });

    it("aborts a signal-aware transport while keeping the timeout message", async () => {
        vi.mocked(fetchWithRefresh).mockImplementationOnce((_url, init) => new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
        }));
        const rejected = expect(downloadXlsx("/api/export")).rejects.toThrow("การดาวน์โหลดใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง");
        await vi.advanceTimersByTimeAsync(120_000);
        await rejected;
        expect(vi.getTimerCount()).toBe(0);
    });
});
