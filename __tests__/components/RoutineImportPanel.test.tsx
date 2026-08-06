import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastMocks = vi.hoisted(() => ({
    success: vi.fn(),
    error: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: toastMocks }));

import { RoutineImportPanel } from "@/components/dashboard/routine/RoutineImportPanel";
import type { RoutineImportRowView } from "@/components/dashboard/routine/import-types";

const batch = {
    id: 1,
    originalFileName: "routine.xlsx",
    fileHashPrefix: "aaaaaaaaaaaa…",
    targetSheet: "มสช.",
    ignoredSheetNames: [],
    asOfDate: "2026-08-04",
    status: "READY",
    uploadedBy: { id: 7, name: "ผู้ดูแลระบบ" },
    totalRows: 0,
    validRows: 0,
    reviewRows: 0,
    excludedRows: 0,
    alreadyImportedRows: 0,
    appliedRows: 0,
    conflictRows: 0,
    failedRows: 0,
    selectedRows: 0,
    unresolvedOwnerRows: 0,
    expiresAt: null,
    appliedAt: null,
    version: 1,
    createdAt: "2026-08-04T00:00:00.000Z",
    updatedAt: "2026-08-04T00:00:00.000Z",
};

function response(body: unknown, ok = true): Response {
    return { ok, json: async () => body } as Response;
}

function selectUploadFile(): void {
    const input = screen.getByLabelText("ไฟล์ Excel (.xls หรือ .xlsx)");
    fireEvent.change(input, {
        target: {
            files: [new File(["fixture"], "routine.xlsx", {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            })],
        },
    });
}

const editableRow = {
    id: 11,
    sourceKey: "routine.xlsx:มสช.:11",
    sourceSheet: "มสช.",
    sourceRow: 11,
    sourceFingerprint: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    status: "REQUIRES_REVIEW",
    selected: false,
    proposedActivation: "ACTIVE",
    reviewReasons: ["MISSING_OWNER"],
    appliedTaskId: null,
    version: 1,
    data: {
        sourceFileName: "routine.xlsx",
        sourceSheet: "มสช.",
        sourceRow: 11,
        sourceFingerprint: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        sourceCells: [],
        categorySourceText: "บุคลากร",
        ownerSourceText: "สมชาย",
        unitCode: "มสช.",
        unitName: "มสช.",
        categoryName: "บุคลากร",
        title: "ตรวจสอบรายการนำเข้า",
        ownerNames: ["สมชาย"],
        mappedEmployeeIds: [],
        mappedEmployeeNames: [],
        scheduleText: "ทุกเดือน",
        contractText: null,
        extraDetails: null,
        normalizedSchedule: null,
        contractStartDate: null,
        contractEndDate: null,
        requiresReview: true,
        reviewReasons: ["MISSING_OWNER"],
        proposedActivation: "ACTIVE",
    },
} satisfies RoutineImportRowView;

const reference = {
    units: [{ id: 1, code: "มสช.", name: "มสช." }],
    categories: [{ id: 1, name: "บุคลากร", sortOrder: 1 }],
    employees: [{
        id: 42,
        firstName: "สมชาย",
        lastName: "ใจดี",
        nickname: "ชาย",
        status: "ACTIVE",
        deletedAt: null,
    }],
};

describe("RoutineImportPanel", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ units: [], categories: [], employees: [] }),
        }));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("explains the exact sheet scope before upload", () => {
        render(<RoutineImportPanel />);

        expect(screen.getByText("นำเข้าข้อมูลจาก Excel")).toBeInTheDocument();
        expect(screen.getByText(/อ่านเฉพาะชีต มสช/)).toBeInTheDocument();
        expect(screen.getByText(/ขนาดไฟล์ไม่เกิน 10 MB/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /อัปโหลดและดูตัวอย่าง/ })).toBeDisabled();
    });

    it("does not show upload success when the rows request fails", async () => {
        const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes("/preview")) return response({ batch: { id: 1 }, reusedExisting: true });
            if (url.includes("/rows")) return response({ error: "โหลดข้อมูลนำเข้าไม่สำเร็จ" }, false);
            if (url.includes("/imports/1")) return response({ batch });
            return response({ units: [], categories: [], employees: [] });
        });
        vi.stubGlobal("fetch", fetchMock);

        render(<RoutineImportPanel />);
        selectUploadFile();
        fireEvent.click(screen.getByRole("button", { name: /อัปโหลดและดูตัวอย่าง/ }));

        await waitFor(() => expect(screen.getByText("โหลดข้อมูลนำเข้าไม่สำเร็จ")).toBeInTheDocument());
        expect(toastMocks.success).not.toHaveBeenCalled();
    });

    it("shows upload success only after the batch and rows requests succeed", async () => {
        const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes("/preview")) return response({ batch: { id: 1 }, reusedExisting: false });
            if (url.includes("/rows")) return response({ rows: [], pagination: { page: 1, limit: 25, total: 0, pages: 1 } });
            if (url.includes("/imports/1")) return response({ batch });
            return response({ units: [], categories: [], employees: [] });
        });
        vi.stubGlobal("fetch", fetchMock);

        render(<RoutineImportPanel />);
        selectUploadFile();
        fireEvent.click(screen.getByRole("button", { name: /อัปโหลดและดูตัวอย่าง/ }));

        await waitFor(() => expect(toastMocks.success).toHaveBeenCalledTimes(1));
        expect(toastMocks.success).toHaveBeenCalledWith("อ่านไฟล์และสร้างตัวอย่างข้อมูลสำเร็จ");
    });

    it("keeps the row editor controls enabled and allows mapping an employee", async () => {
        const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes("/preview")) return response({ batch: { id: 1 }, reusedExisting: false });
            if (url.includes("/rows")) return response({
                rows: [editableRow],
                pagination: { page: 1, limit: 25, total: 1, pages: 1 },
            });
            if (url.includes("/imports/1")) return response({ batch: {
                ...batch,
                totalRows: 1,
                reviewRows: 1,
                unresolvedOwnerRows: 1,
            } });
            return response(reference);
        });
        vi.stubGlobal("fetch", fetchMock);

        render(<RoutineImportPanel />);
        selectUploadFile();
        fireEvent.click(screen.getByRole("button", { name: /อัปโหลดและดูตัวอย่าง/ }));

        const editButton = await screen.findByRole("button", { name: /แก้ไข/ });
        expect(editButton).toBeEnabled();
        fireEvent.click(editButton);

        const dialog = await screen.findByRole("dialog");
        const titleInput = screen.getByDisplayValue("ตรวจสอบรายการนำเข้า");
        expect(titleInput).toBeEnabled();
        fireEvent.change(titleInput, { target: { value: "รายการที่แก้ไขแล้ว" } });
        expect(titleInput).toHaveValue("รายการที่แก้ไขแล้ว");

        const searchInput = screen.getByRole("searchbox", { name: "ค้นหาพนักงาน" });
        expect(searchInput).toBeEnabled();
        fireEvent.change(searchInput, { target: { value: "สมชาย" } });

        const employeeOption = await screen.findByRole("option", { name: /เพิ่ม สมชาย ใจดี \(ชาย\)/ });
        expect(employeeOption).toBeEnabled();
        fireEvent.click(employeeOption);

        expect(dialog).toHaveTextContent("สมชาย ใจดี (ชาย)");
        expect(dialog).toHaveTextContent("เลือกแล้ว 1 คน");
    });
});
