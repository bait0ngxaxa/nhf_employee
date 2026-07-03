import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { StockAdminReports } from "@/components/dashboard/stock/StockAdminReports";
import { apiGet } from "@/lib/client/api-client";
import { triggerDownload } from "@/lib/helpers/download";

vi.mock("@/lib/client/api-client", () => ({
    apiGet: vi.fn(),
}));

vi.mock("@/lib/helpers/download", () => ({
    triggerDownload: vi.fn(),
}));

vi.mock("sonner", () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
    },
}));

describe("StockAdminReports", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("uses a newly returned year for meta and export", async () => {
        vi.mocked(apiGet).mockImplementation(async (url) => {
            if (url === "/api/stock/reports/export?yearsOnly=1") {
                return {
                    success: true,
                    data: { years: [2031, 2030] },
                    status: 200,
                    requestId: "req-years",
                } as never;
            }

            if (url === "/api/stock/reports/export?metaOnly=1&year=2031") {
                return {
                    success: true,
                    data: { year: 2031, count: 8, maxRows: 5000 },
                    status: 200,
                    requestId: "req-meta",
                } as never;
            }

            if (url === "/api/stock/reports/export?metaOnly=1&reportType=balances") {
                return {
                    success: true,
                    data: { count: 12, maxRows: 5000 },
                    status: 200,
                    requestId: "req-balance-meta",
                } as never;
            }

            return {
                success: true,
                data: { year: 2026, count: 3, maxRows: 5000 },
                status: 200,
                requestId: "req-meta-current-year",
            } as never;
        });

        render(<StockAdminReports />);

        await waitFor(() => {
            expect(apiGet).toHaveBeenCalledWith("/api/stock/reports/export?yearsOnly=1");
            expect(apiGet).toHaveBeenCalledWith(
                "/api/stock/reports/export?metaOnly=1&year=2026",
            );
            expect(apiGet).toHaveBeenCalledWith(
                "/api/stock/reports/export?metaOnly=1&reportType=balances",
            );
            expect(apiGet).toHaveBeenCalledWith(
                "/api/stock/reports/export?metaOnly=1&year=2031",
            );
        });

        expect(await screen.findByRole("combobox", { name: "เลือกปีรีพอร์ตวัสดุ" })).toHaveTextContent(
            "2031",
        );
        await waitFor(() => {
            expect(screen.getByText("8 รายการ")).toBeInTheDocument();
            expect(
                screen.getByRole("button", { name: "ดาวน์โหลด Excel" }),
            ).toBeEnabled();
        });

        fireEvent.click(
            screen.getByRole("button", { name: "ดาวน์โหลด Excel" }),
        );

        await waitFor(() => {
            expect(triggerDownload).toHaveBeenCalledWith(
                "/api/stock/reports/export?format=xlsx&year=2031",
            );
        });
        expect(toast.success).toHaveBeenCalledWith(
            "เริ่มดาวน์โหลดไฟล์แล้ว",
            expect.objectContaining({
                description: "กำลังส่งออกรายงานวัสดุ 8 รายการ (ปี 2031)",
            }),
        );

        fireEvent.click(
            screen.getByRole("button", { name: "ดาวน์โหลดสต๊อกคงเหลือ" }),
        );

        await waitFor(() => {
            expect(triggerDownload).toHaveBeenCalledWith(
                "/api/stock/reports/export?format=xlsx&reportType=balances",
            );
        });
        expect(toast.success).toHaveBeenCalledWith(
            "เริ่มดาวน์โหลดไฟล์แล้ว",
            expect.objectContaining({
                description: "กำลังส่งออกยอดคงเหลือสต๊อก 12 รายการ",
            }),
        );
    });

    it("disables the annual export button while preparing the file", async () => {
        const exportMeta = createDeferred<never>();
        let selectedYearMetaCalls = 0;

        mockReportApis((url) => {
            if (url === "/api/stock/reports/export?metaOnly=1&year=2031") {
                selectedYearMetaCalls += 1;
                if (selectedYearMetaCalls === 1) {
                    return createSuccess({ year: 2031, count: 8, maxRows: 5000 });
                }
                return exportMeta.promise;
            }
            return null;
        });

        render(<StockAdminReports />);

        await waitFor(() => {
            expect(screen.getByRole("button", { name: "ดาวน์โหลด Excel" })).toBeEnabled();
        });

        fireEvent.click(screen.getByRole("button", { name: "ดาวน์โหลด Excel" }));

        expect(
            await screen.findByRole("button", { name: "กำลังเตรียมไฟล์" }),
        ).toBeDisabled();
        expect(screen.getByText("กำลังเริ่มดาวน์โหลด")).toBeInTheDocument();
        expect(triggerDownload).not.toHaveBeenCalled();

        exportMeta.resolve(createSuccess({ year: 2031, count: 8, maxRows: 5000 }));

        await waitFor(() => {
            expect(triggerDownload).toHaveBeenCalledWith(
                "/api/stock/reports/export?format=xlsx&year=2031",
            );
        });
    });

    it("disables the balance export button while preparing the file", async () => {
        const exportMeta = createDeferred<never>();
        let balanceMetaCalls = 0;

        mockReportApis((url) => {
            if (url === "/api/stock/reports/export?metaOnly=1&reportType=balances") {
                balanceMetaCalls += 1;
                if (balanceMetaCalls === 1) {
                    return createSuccess({ count: 12, maxRows: 5000 });
                }
                return exportMeta.promise;
            }
            return null;
        });

        render(<StockAdminReports />);

        await waitFor(() => {
            expect(
                screen.getByRole("button", { name: "ดาวน์โหลดสต๊อกคงเหลือ" }),
            ).toBeEnabled();
        });

        fireEvent.click(
            screen.getByRole("button", { name: "ดาวน์โหลดสต๊อกคงเหลือ" }),
        );

        expect(
            await screen.findByRole("button", { name: "กำลังเตรียมไฟล์" }),
        ).toBeDisabled();
        expect(screen.getByText("กำลังเริ่มดาวน์โหลด")).toBeInTheDocument();
        expect(triggerDownload).not.toHaveBeenCalled();

        exportMeta.resolve(createSuccess({ count: 12, maxRows: 5000 }));

        await waitFor(() => {
            expect(triggerDownload).toHaveBeenCalledWith(
                "/api/stock/reports/export?format=xlsx&reportType=balances",
            );
        });
    });
});

type ApiMockOverride = (url: string) => Promise<never> | never | null;

function mockReportApis(override?: ApiMockOverride): void {
    vi.mocked(apiGet).mockImplementation(async (url) => {
        const urlText = String(url);
        const overridden = override?.(urlText);
        if (overridden) {
            return overridden;
        }

        if (urlText === "/api/stock/reports/export?yearsOnly=1") {
            return createSuccess({ years: [2031, 2030] });
        }

        if (urlText === "/api/stock/reports/export?metaOnly=1&year=2031") {
            return createSuccess({ year: 2031, count: 8, maxRows: 5000 });
        }

        if (urlText === "/api/stock/reports/export?metaOnly=1&reportType=balances") {
            return createSuccess({ count: 12, maxRows: 5000 });
        }

        return createSuccess({ year: 2026, count: 3, maxRows: 5000 });
    });
}

function createSuccess<T>(data: T): never {
    return {
        success: true,
        data,
        status: 200,
        requestId: "req-test",
    } as never;
}

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
