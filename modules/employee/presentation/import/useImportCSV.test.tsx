import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiPostMock } = vi.hoisted(() => ({
    apiPostMock: vi.fn(),
}));

vi.mock("@/lib/helpers/file-validation", () => ({
    validateCSVFile: vi.fn(async () => ({ isValid: true })),
}));
vi.mock("@/lib/client/api-client", () => ({
    apiPost: apiPostMock,
}));
vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        warning: vi.fn(),
        error: vi.fn(),
    },
}));

import { ImportEmployeeCSV } from "./ImportEmployeeCSV";
import { API_ROUTES } from "@/lib/ssot/routes";
import type { ImportResult } from "./types";
import { toast } from "sonner";

type ImportResponse = {
    success: boolean;
    data: { result: ImportResult };
    error?: string;
};

function selectFile(file: File): void {
    fireEvent.change(screen.getByLabelText("เลือกไฟล์ CSV"), {
        target: { files: [file] },
    });
}

function createTextFile(content: string): File {
    const file = new File([content], "employees.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", {
        configurable: true,
        value: async () => content,
    });
    return file;
}

function createEmployeeCSV(rows: string[]): string {
    return [
        "ชื่อ,นามสกุล,ตำแหน่ง,แผนก,อีเมล,เบอร์โทร,สังกัด,ชื่อเล่น,สถานะ",
        ...rows.map((row) => {
            const fieldCount = row.split(",").length;
            return row + ",".repeat(Math.max(0, 9 - fieldCount));
        }),
    ].join("\n");
}

function createSuccessfulResult(success: ImportResult["success"] = [{
    firstName: "สมชาย",
    lastName: "ใจดี",
    position: "เจ้าหน้าที่",
    department: "ADMIN",
}]): ImportResponse {
    return {
        success: true,
        data: {
            result: {
                success,
                errors: [],
            },
        },
    };
}

beforeEach(() => {
    apiPostMock.mockReset();
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.warning).mockClear();
    vi.mocked(toast.error).mockClear();
});

describe("Employee CSV import limits", () => {
    it("rejects files larger than 5 MB in the browser", async () => {
        render(<ImportEmployeeCSV />);

        selectFile(new File(
            [new Uint8Array(5 * 1024 * 1024 + 1)],
            "employees.csv",
            { type: "text/csv" },
        ));

        await waitFor(() => {
            expect(screen.getByText("ไฟล์มีขนาดใหญ่เกินไป (สูงสุด 5MB)")).toBeInTheDocument();
        });
        expect(screen.queryByText("ตรวจสอบข้อมูลก่อนนำเข้า")).not.toBeInTheDocument();
    });

    it("rejects more than 1,000 parsed Employee rows before posting", async () => {
        render(<ImportEmployeeCSV />);

        const rows = Array.from(
            { length: 1001 },
            (_, index) => `ชื่อ${index},นามสกุล${index},นักพัฒนา,ADMIN`,
        );
        selectFile(createTextFile(["ชื่อ,นามสกุล,ตำแหน่ง,แผนก", ...rows].join("\n")));

        await waitFor(() => {
            expect(screen.getByText("นำเข้าได้สูงสุด 1,000 แถวต่อครั้ง")).toBeInTheDocument();
        });
        expect(screen.queryByText("ตรวจสอบข้อมูลก่อนนำเข้า")).not.toBeInTheDocument();
    });
});

describe("Employee CSV import workflow", () => {
    it("submits corrected fields and preserves the original CSV row number", async () => {
        apiPostMock.mockResolvedValue(createSuccessfulResult());
        render(<ImportEmployeeCSV />);
        selectFile(createTextFile(createEmployeeCSV([
            "สมชาย,ใจดี,เจ้าหน้าที่,ADMIN,somchai@thainhf.org,0812345678,สำนักงานใหญ่,ชาย,active",
        ])));

        await screen.findByText("ตรวจสอบข้อมูลก่อนนำเข้า");
        const editButton = screen.getAllByRole("button", {
            name: "แก้ไขข้อมูลแถว CSV ที่ 2",
        }).at(0);
        if (!editButton) throw new Error("ไม่พบปุ่มแก้ไขแถว CSV");
        fireEvent.click(editButton);
        fireEvent.change(screen.getByLabelText("ชื่อ"), {
            target: { value: "สมชายแก้ไข" },
        });
        fireEvent.change(screen.getByLabelText("สังกัด"), {
            target: { value: "ฝ่ายบริการ" },
        });
        fireEvent.click(screen.getByRole("button", { name: "บันทึกการแก้ไข" }));
        fireEvent.click(screen.getByRole("button", { name: "นำเข้าข้อมูล 1 แถว" }));

        await waitFor(() => {
            expect(apiPostMock).toHaveBeenCalledTimes(1);
        });
        expect(apiPostMock).toHaveBeenCalledWith(
            API_ROUTES.employees.import,
            {
                employees: [
                    expect.objectContaining({
                        sourceRow: 2,
                        firstName: "สมชายแก้ไข",
                        affiliation: "ฝ่ายบริการ",
                    }),
                ],
            },
        );
        expect(await screen.findByText("นำเข้าข้อมูลสำเร็จ")).toBeInTheDocument();
    });

    it("blocks local validation errors and gives specific correction guidance", async () => {
        render(<ImportEmployeeCSV />);
        selectFile(createTextFile(createEmployeeCSV([
            "สมชาย,ใจดี,เจ้าหน้าที่,UNKNOWN,person@gmail.com,,,,unknown",
        ])));

        await screen.findByText("แก้ไขแถวที่มีข้อความแจ้งก่อนนำเข้า");

        expect(screen.getAllByText(/กรุณาใช้อีเมลองค์กร/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/รหัสแผนกไม่ถูกต้อง/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/สถานะพนักงาน/).length).toBeGreaterThan(0);
        expect(screen.getByRole("button", { name: "แก้ไข 1 แถวก่อนนำเข้า" })).toBeDisabled();
        expect(apiPostMock).not.toHaveBeenCalled();
    });

    it("lets users reach rows beyond the first 100", async () => {
        render(<ImportEmployeeCSV />);
        const rows = Array.from(
            { length: 130 },
            (_, index) => "พนักงาน" + index + ",ทดสอบ,เจ้าหน้าที่,ADMIN",
        );
        selectFile(createTextFile(createEmployeeCSV(rows)));

        await screen.findByText("ตรวจสอบข้อมูลก่อนนำเข้า");
        const nextPageButton = screen.getByRole("button", { name: /หน้าถัดไป/ });
        for (let page = 1; page < 6; page += 1) {
            fireEvent.click(nextPageButton);
        }

        expect(screen.getByText("แสดงแถว 126–130 จาก 130 แถว")).toBeInTheDocument();
        expect(screen.getAllByRole("button", {
            name: "แก้ไขข้อมูลแถว CSV ที่ 127",
        })).toHaveLength(2);
    });

    it("recovers only server-rejected rows after a partial success", async () => {
        const failedEmployee = {
            sourceRow: 3,
            firstName: "สมหญิง",
            lastName: "ใจดี",
            position: "เจ้าหน้าที่",
            department: "ADMIN",
            email: "duplicate@thainhf.org",
        };
        apiPostMock
            .mockResolvedValueOnce({
                success: true,
                data: {
                    result: {
                        success: [{
                            firstName: "สมชาย",
                            lastName: "ใจดี",
                            position: "เจ้าหน้าที่",
                            department: "ADMIN",
                            email: "somchai@thainhf.org",
                        }],
                        errors: [{
                            row: 3,
                            data: failedEmployee,
                            error: "อีเมลนี้ถูกใช้งานแล้ว",
                        }],
                    },
                },
            })
            .mockResolvedValueOnce(createSuccessfulResult([failedEmployee]));
        render(<ImportEmployeeCSV />);
        selectFile(createTextFile(createEmployeeCSV([
            "สมชาย,ใจดี,เจ้าหน้าที่,ADMIN,somchai@thainhf.org",
            "สมหญิง,ใจดี,เจ้าหน้าที่,ADMIN,duplicate@thainhf.org",
        ])));

        await screen.findByText("ตรวจสอบข้อมูลก่อนนำเข้า");
        fireEvent.click(screen.getByRole("button", { name: "นำเข้าข้อมูล 2 แถว" }));
        expect(await screen.findByText("นำเข้าสำเร็จบางรายการ")).toBeInTheDocument();
        expect(toast.warning).toHaveBeenCalledWith("นำเข้าสำเร็จบางรายการ", {
            description: "สำเร็จ 1 รายการ · ไม่สำเร็จ 1 รายการ",
        });
        expect(screen.getByText("แถว CSV ที่ 3")).toBeInTheDocument();
        expect(screen.getByText("duplicate@thainhf.org")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", {
            name: "แก้ไขและนำเข้าเฉพาะแถวที่ไม่สำเร็จ",
        }));

        expect(screen.getByRole("group", { name: "สรุปการตรวจสอบข้อมูล" }))
            .toHaveTextContent("ทั้งหมด 1 แถว");
        expect(screen.getAllByRole("button", {
            name: "แก้ไขข้อมูลแถว CSV ที่ 3",
        })).toHaveLength(2);
        fireEvent.click(screen.getByRole("button", { name: "นำเข้าข้อมูล 1 แถว" }));

        await waitFor(() => {
            expect(apiPostMock).toHaveBeenCalledTimes(2);
        });
        expect(apiPostMock).toHaveBeenNthCalledWith(
            1,
            API_ROUTES.employees.import,
            { employees: expect.arrayContaining([expect.objectContaining({ firstName: "สมชาย" }), expect.objectContaining({ firstName: "สมหญิง" })]) },
        );
        expect(apiPostMock).toHaveBeenNthCalledWith(
            2,
            API_ROUTES.employees.import,
            {
                employees: [
                    expect.objectContaining({
                        sourceRow: 3,
                        firstName: "สมหญิง",
                        email: "duplicate@thainhf.org",
                    }),
                ],
            },
        );
        expect(await screen.findByText("นำเข้าข้อมูลสำเร็จ")).toBeInTheDocument();
        expect(screen.getByText("รายการที่นำเข้าสำเร็จในครั้งก่อนจะไม่ถูกส่งซ้ำ")).toBeInTheDocument();
    });

    it("reports a zero-success import as a complete failure", async () => {
        const onSuccess = vi.fn();
        apiPostMock.mockResolvedValue({
            success: true,
            data: {
                result: {
                    success: [],
                    errors: [{
                        row: 2,
                        data: {
                            firstName: "สมชาย",
                            lastName: "ใจดี",
                            email: "somchai@thainhf.org",
                            position: "เจ้าหน้าที่",
                            department: "ADMIN",
                        },
                        error: "อีเมลนี้ถูกใช้งานแล้ว",
                    }],
                },
            },
        });
        render(<ImportEmployeeCSV onSuccess={onSuccess} />);
        selectFile(createTextFile(createEmployeeCSV([
            "สมชาย,ใจดี,เจ้าหน้าที่,ADMIN,somchai@thainhf.org",
        ])));

        await screen.findByText("ตรวจสอบข้อมูลก่อนนำเข้า");
        fireEvent.click(screen.getByRole("button", { name: "นำเข้าข้อมูล 1 แถว" }));

        expect(await screen.findByText("นำเข้าข้อมูลไม่สำเร็จ")).toBeInTheDocument();
        expect(screen.queryByText("นำเข้าสำเร็จบางรายการ")).not.toBeInTheDocument();
        expect(toast.error).toHaveBeenCalledWith("นำเข้าข้อมูลไม่สำเร็จ", {
            description: "สำเร็จ 0 รายการ · ไม่สำเร็จ 1 รายการ",
        });
        expect(toast.success).not.toHaveBeenCalled();
        expect(toast.warning).not.toHaveBeenCalled();
        expect(onSuccess).not.toHaveBeenCalled();
    });

    it("prevents duplicate POST requests while a submission is pending", async () => {
        let resolveRequest: ((value: ImportResponse) => void) | undefined;
        const pendingRequest = new Promise<ImportResponse>((resolve) => {
            resolveRequest = resolve;
        });
        apiPostMock.mockReturnValue(pendingRequest);
        render(<ImportEmployeeCSV />);
        selectFile(createTextFile(createEmployeeCSV([
            "สมชาย,ใจดี,เจ้าหน้าที่,ADMIN,somchai@thainhf.org",
        ])));

        await screen.findByText("ตรวจสอบข้อมูลก่อนนำเข้า");
        const importButton = screen.getByRole("button", { name: "นำเข้าข้อมูล 1 แถว" });
        fireEvent.click(importButton);
        fireEvent.click(importButton);

        await waitFor(() => {
            expect(apiPostMock).toHaveBeenCalledTimes(1);
        });
        await act(async () => {
            resolveRequest?.(createSuccessfulResult());
        });
        expect(await screen.findByText("นำเข้าข้อมูลสำเร็จ")).toBeInTheDocument();
        expect(apiPostMock).toHaveBeenCalledTimes(1);
    });
});
