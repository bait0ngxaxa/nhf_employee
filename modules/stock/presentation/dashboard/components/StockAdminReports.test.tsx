import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { StockAdminReports } from "./StockAdminReports";
import { apiGet } from "@/lib/client/api-client";
import { downloadXlsx } from "@/lib/client/xlsx-download";

vi.mock("@/lib/client/api-client", () => ({
    apiGet: vi.fn(),
}));

vi.mock("@/lib/client/xlsx-download", () => ({
    downloadXlsx: vi.fn(),
}));

vi.mock("sonner", () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
        info: vi.fn(),
    },
}));

describe("StockAdminReports", () => {
    it("exports line-level raw data only after explicit submission", async () => {
        mockReportApis();
        render(<StockAdminReports canExportReports />);
        expect(downloadXlsx).not.toHaveBeenCalled();
        fireEvent.change(screen.getByLabelText("ปีข้อมูลดิบ ค.ศ."), { target: { value: "2024" } });
        fireEvent.change(screen.getByLabelText("โครงการข้อมูลดิบ"), { target: { value: "PROJECT-RAW" } });
        fireEvent.submit(screen.getByRole("form", { name: "ส่งออกข้อมูลดิบการจ่ายวัสดุ" }));
        await waitFor(() => expect(downloadXlsx).toHaveBeenCalledWith(expect.stringContaining("reportType=raw-issued")));
        const url = String(vi.mocked(downloadXlsx).mock.calls[0][0]);
        expect(url).toContain("year=2024");
        expect(url).toContain("projectCode=PROJECT-RAW");
    });
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(downloadXlsx).mockResolvedValue(undefined);
    });

    it.each(["requests", "balances"])("awaits %s download and preserves independent controls", async (report) => {
        mockReportApis();
        let finish: (() => void) | undefined;
        vi.mocked(downloadXlsx).mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve; }));
        render(<StockAdminReports canExportReports />);
        const label = report === "requests" ? "ดาวน์โหลด Excel" : "ดาวน์โหลด Excel สต๊อกคงเหลือ";
        const otherLabel = report === "requests" ? "ดาวน์โหลด Excel สต๊อกคงเหลือ" : "ดาวน์โหลด Excel";
        await waitFor(() => expect(screen.getByRole("button", { name: label })).toBeEnabled());
        const button = screen.getByRole("button", { name: label });
        fireEvent.click(button);
        fireEvent.click(button);
        await waitFor(() => expect(downloadXlsx).toHaveBeenCalledTimes(1));
        expect(button).toBeDisabled();
        expect(screen.getByRole("button", { name: otherLabel })).toBeEnabled();
        expect(toast.info).not.toHaveBeenCalled();
        await act(async () => { finish?.(); });
        expect(button).toBeEnabled();
    });

    it.each(["requests", "balances"])("reports %s download errors", async (report) => {
        mockReportApis();
        vi.mocked(downloadXlsx).mockRejectedValueOnce(new Error("ไม่มีสิทธิ์ดาวน์โหลด"));
        render(<StockAdminReports canExportReports />);
        const label = report === "requests" ? "ดาวน์โหลด Excel" : "ดาวน์โหลด Excel สต๊อกคงเหลือ";
        await waitFor(() => expect(screen.getByRole("button", { name: label })).toBeEnabled());
        fireEvent.click(screen.getByRole("button", { name: label }));
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith(expect.any(String), { description: "ไม่มีสิทธิ์ดาวน์โหลด" }));
        expect(screen.getByRole("button", { name: label })).toBeEnabled();
        expect(toast.info).not.toHaveBeenCalled();
    });

    it("does not load or download without export capability", () => {
        render(<StockAdminReports canExportReports={false} />);
        expect(apiGet).not.toHaveBeenCalled();
        expect(downloadXlsx).not.toHaveBeenCalled();
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

        render(<StockAdminReports canExportReports />);

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
            expect(downloadXlsx).toHaveBeenCalledWith(
                "/api/stock/reports/export?format=xlsx&year=2031",
            );
        });
        expect(toast.info).toHaveBeenCalledWith(
            "เริ่มดาวน์โหลดไฟล์ Excel แล้ว",
            expect.objectContaining({
                description: "กำลังส่งออกรายงานวัสดุ 8 รายการ (ปี 2031)",
            }),
        );

        fireEvent.click(
            screen.getByRole("button", { name: "ดาวน์โหลด Excel สต๊อกคงเหลือ" }),
        );

        await waitFor(() => {
            expect(downloadXlsx).toHaveBeenCalledWith(
                "/api/stock/reports/export?format=xlsx&reportType=balances",
            );
        });
        expect(toast.info).toHaveBeenCalledWith(
            "เริ่มดาวน์โหลดไฟล์ Excel แล้ว",
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

        render(<StockAdminReports canExportReports />);

        await waitFor(() => {
            expect(screen.getByRole("button", { name: "ดาวน์โหลด Excel" })).toBeEnabled();
        });

        fireEvent.click(screen.getByRole("button", { name: "ดาวน์โหลด Excel" }));

        expect(
            await screen.findByRole("button", { name: "กำลังเตรียมไฟล์" }),
        ).toBeDisabled();
        expect(screen.getByText("กำลังเริ่มดาวน์โหลด")).toBeInTheDocument();
        expect(downloadXlsx).not.toHaveBeenCalled();

        exportMeta.resolve(createSuccess({ year: 2031, count: 8, maxRows: 5000 }));

        await waitFor(() => {
            expect(downloadXlsx).toHaveBeenCalledWith(
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

        render(<StockAdminReports canExportReports />);

        await waitFor(() => {
            expect(
                screen.getByRole("button", { name: "ดาวน์โหลด Excel สต๊อกคงเหลือ" }),
            ).toBeEnabled();
        });

        fireEvent.click(
            screen.getByRole("button", { name: "ดาวน์โหลด Excel สต๊อกคงเหลือ" }),
        );

        expect(
            await screen.findByRole("button", { name: "กำลังเตรียมไฟล์" }),
        ).toBeDisabled();
        expect(screen.getByText("กำลังเริ่มดาวน์โหลด")).toBeInTheDocument();
        expect(downloadXlsx).not.toHaveBeenCalled();

        exportMeta.resolve(createSuccess({ count: 12, maxRows: 5000 }));

        await waitFor(() => {
            expect(downloadXlsx).toHaveBeenCalledWith(
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
