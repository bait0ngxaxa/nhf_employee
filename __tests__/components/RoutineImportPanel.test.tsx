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
    selectedValidRows: 0,
    unresolvedOwnerRows: 0,
    expiresAt: null,
    appliedAt: null,
    errorMessage: null,
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
    units: [{ id: 1, code: "มสช.", name: "มสช.", isActive: true }],
    categories: [{ id: 1, name: "บุคลากร", sortOrder: 1, isActive: true }],
    employees: [{
        id: 42,
        firstName: "สมชาย",
        lastName: "ใจดี",
        nickname: "ชาย",
        departmentId: 1,
        status: "ACTIVE",
        deletedAt: null,
    }, {
        id: 43,
        firstName: "สุดา",
        lastName: "ใจดี",
        nickname: "ดา",
        departmentId: 1,
        status: "ACTIVE",
        deletedAt: null,
    }, {
        id: 44,
        firstName: "อดีต",
        lastName: "พนักงาน",
        nickname: "เก่า",
        departmentId: 1,
        status: "INACTIVE",
        deletedAt: null,
    }, {
        id: 45,
        firstName: "ปิด",
        lastName: "การใช้งาน",
        nickname: "ปิด",
        departmentId: 1,
        status: "INACTIVE",
        deletedAt: null,
    }],
};

const validRow = {
    ...editableRow,
    status: "VALID",
    selected: true,
    reviewReasons: [],
    data: {
        ...editableRow.data,
        mappedEmployeeIds: [42],
        mappedEmployeeNames: ["สมชาย ใจดี"],
        mappedAssignees: [{ employeeId: 42, role: "OWNER" as const }],
        requiresReview: false,
        reviewReasons: [],
    },
} satisfies RoutineImportRowView;

const staleRow = {
    ...editableRow,
    data: {
        ...editableRow.data,
        mappedEmployeeIds: [44, 999],
        mappedEmployeeNames: ["อดีต พนักงาน", "ไม่พบข้อมูลพนักงาน (ID: 999)"],
        mappedAssignees: [
            { employeeId: 44, role: "OWNER" as const },
            { employeeId: 999, role: "CO_OWNER" as const },
        ],
        reviewReasons: ["OWNER_MAPPING_EMPLOYEE_INACTIVE:44", "OWNER_MAPPING_EMPLOYEE_NOT_FOUND:999"],
    },
} satisfies RoutineImportRowView;

function importFetchMock(
    row: RoutineImportRowView,
    patchRow?: RoutineImportRowView,
    batchOverrides: Record<string, unknown> = {},
): ReturnType<typeof vi.fn> {
    return vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === "PATCH") return response({ row: patchRow ?? row });
        if (url.includes("/preview")) return response({ batch: { id: 1 }, reusedExisting: false });
        if (url.includes("/rows")) return response({
            rows: [row],
            pagination: { page: 1, limit: 25, total: 1, pages: 1 },
        });
        if (url.endsWith("/imports/1")) return response({ batch: { ...batch, ...batchOverrides, totalRows: 1 } });
        if (url.endsWith("/reference")) return response(reference);
        return response({ units: [], categories: [], employees: [] });
    });
}

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
        expect(screen.getByRole("checkbox", { name: "เลือกรายการนี้เพื่อนำเข้า" })).toBeChecked();
        expect(dialog).toHaveTextContent("จาก Excel: สมชาย");
    });

    it("assigns one owner, demotes the previous owner, and promotes a replacement on removal", async () => {
        vi.stubGlobal("fetch", importFetchMock(editableRow));

        render(<RoutineImportPanel />);
        selectUploadFile();
        fireEvent.click(screen.getByRole("button", { name: /อัปโหลดและดูตัวอย่าง/ }));
        fireEvent.click(await screen.findByRole("button", { name: /แก้ไข/ }));

        const searchInput = await screen.findByRole("searchbox", { name: "ค้นหาพนักงาน" });
        fireEvent.change(searchInput, { target: { value: "ชาย" } });
        fireEvent.click(await screen.findByRole("option", { name: /เพิ่ม สมชาย ใจดี \(ชาย\)/ }));
        fireEvent.change(searchInput, { target: { value: "ดา" } });
        fireEvent.click(await screen.findByRole("option", { name: /เพิ่ม สุดา ใจดี \(ดา\)/ }));

        const firstRole = screen.getByRole("combobox", { name: "บทบาทของ สมชาย ใจดี (ชาย)" });
        const secondRole = screen.getByRole("combobox", { name: "บทบาทของ สุดา ใจดี (ดา)" });
        expect(firstRole).toHaveValue("OWNER");
        expect(secondRole).toHaveValue("CO_OWNER");

        fireEvent.change(secondRole, { target: { value: "OWNER" } });
        expect(firstRole).toHaveValue("CO_OWNER");
        expect(secondRole).toHaveValue("OWNER");

        fireEvent.click(screen.getByRole("button", { name: "นำ สุดา ใจดี (ดา) ออกจากผู้รับผิดชอบ" }));
        expect(firstRole).toHaveValue("OWNER");
    });

    it("shows unavailable and unknown mapped employees and prevents adding unavailable employees", async () => {
        vi.stubGlobal("fetch", importFetchMock(staleRow));

        render(<RoutineImportPanel />);
        selectUploadFile();
        fireEvent.click(screen.getByRole("button", { name: /อัปโหลดและดูตัวอย่าง/ }));
        fireEvent.click(await screen.findByRole("button", { name: /แก้ไข/ }));
        const dialog = await screen.findByRole("dialog");

        expect(dialog).toHaveTextContent("อดีต พนักงาน (เก่า)");
        expect(dialog).toHaveTextContent("ไม่พร้อมใช้งาน");
        expect(dialog).toHaveTextContent("ไม่พบข้อมูลพนักงาน (ID: 999)");

        const searchInput = screen.getByRole("searchbox", { name: "ค้นหาพนักงาน" });
        fireEvent.change(searchInput, { target: { value: "ปิด" } });
        expect(screen.getByRole("checkbox", { name: "เลือก ปิด การใช้งาน (ปิด)" })).toBeDisabled();

        fireEvent.click(screen.getByRole("button", { name: "นำ ไม่พบข้อมูลพนักงาน (ID: 999) ออกจากผู้รับผิดชอบ" }));
        expect(dialog).not.toHaveTextContent("ไม่พบข้อมูลพนักงาน (ID: 999)");
    });

    it("keeps the editor open and shows remaining review reasons when the server still requires review", async () => {
        const reviewResponse = {
            ...staleRow,
            reviewReasons: ["OWNER_MAPPING_EMPLOYEE_INACTIVE:44"],
            selected: true,
            data: {
                ...staleRow.data,
                reviewReasons: ["OWNER_MAPPING_EMPLOYEE_INACTIVE:44"],
                requiresReview: true,
            },
        } satisfies RoutineImportRowView;
        vi.stubGlobal("fetch", importFetchMock(editableRow, reviewResponse));

        render(<RoutineImportPanel />);
        selectUploadFile();
        fireEvent.click(screen.getByRole("button", { name: /อัปโหลดและดูตัวอย่าง/ }));
        fireEvent.click(await screen.findByRole("button", { name: /แก้ไข/ }));
        fireEvent.click(await screen.findByRole("button", { name: /บันทึกแถว/ }));

        expect(await screen.findByText("บันทึกข้อมูลแล้ว แต่ยังมีรายการที่ต้องแก้ไข")).toBeInTheDocument();
        expect(screen.getByRole("dialog")).toHaveTextContent("พนักงานไม่พร้อมใช้งาน (44)");
        expect(screen.getByRole("button", { name: /บันทึกแถว/ })).toBeInTheDocument();
    });

    it("closes the editor only when the server returns VALID", async () => {
        vi.stubGlobal("fetch", importFetchMock(editableRow, validRow, { validRows: 1, selectedRows: 1 }));

        render(<RoutineImportPanel />);
        selectUploadFile();
        fireEvent.click(screen.getByRole("button", { name: /อัปโหลดและดูตัวอย่าง/ }));
        fireEvent.click(await screen.findByRole("button", { name: /แก้ไข/ }));

        const searchInput = screen.getByRole("searchbox", { name: "ค้นหาพนักงาน" });
        fireEvent.change(searchInput, { target: { value: "สมชาย" } });
        fireEvent.click(await screen.findByRole("option", { name: /เพิ่ม สมชาย ใจดี \(ชาย\)/ }));
        fireEvent.click(screen.getByRole("button", { name: /บันทึกแถว/ }));

        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(toastMocks.success).toHaveBeenCalledWith("บันทึกแถวพร้อมนำเข้าแล้ว");
    });

    it.each(["COMPLETED", "FAILED", "CANCELLED", "EXPIRED"] as const)("disables editing for terminal batch status %s", async (status) => {
        vi.stubGlobal("fetch", importFetchMock(validRow, undefined, { status }));

        render(<RoutineImportPanel />);
        selectUploadFile();
        fireEvent.click(screen.getByRole("button", { name: /อัปโหลดและดูตัวอย่าง/ }));

        const editButton = await screen.findByRole("button", { name: /แก้ไข/ });
        expect(editButton).toBeDisabled();
        expect(screen.getByRole("status")).toHaveTextContent("จึงแก้ไข");
    });

    it("offers a new editable preview when a completed batch still has review rows", async () => {
        vi.stubGlobal("fetch", importFetchMock(editableRow, undefined, {
            status: "COMPLETED",
            appliedRows: 1,
            reviewRows: 66,
            selectedRows: 1,
            unresolvedOwnerRows: 66,
        }));

        render(<RoutineImportPanel />);
        selectUploadFile();
        fireEvent.click(screen.getByRole("button", { name: /อัปโหลดและดูตัวอย่าง/ }));

        const continueButton = await screen.findByRole("button", {
            name: "อัปโหลดไฟล์เดิมเพื่อ map ต่อ",
        });
        expect(continueButton).toBeEnabled();
        expect(screen.getByRole("status")).toHaveTextContent(
            "ยังเหลือ 66 รายการที่ต้องตรวจสอบ",
        );

        fireEvent.click(continueButton);
        expect(screen.getByText("นำเข้าข้อมูลจาก Excel")).toBeInTheDocument();
    });

    it("explains why confirmation remains disabled while review rows are selected", async () => {
        vi.stubGlobal("fetch", importFetchMock(editableRow, undefined, {
            totalRows: 1,
            reviewRows: 1,
            selectedRows: 1,
            unresolvedOwnerRows: 1,
        }));

        render(<RoutineImportPanel />);
        selectUploadFile();
        fireEvent.click(screen.getByRole("button", { name: /อัปโหลดและดูตัวอย่าง/ }));

        const applyButton = await screen.findByRole("button", { name: /ยืนยันและนำเข้า/ });
        expect(applyButton).toBeDisabled();
        expect(screen.getByRole("status")).toHaveTextContent(
            "กรุณาแก้ไขรายการที่ต้องตรวจสอบ หรือยกเลิกการเลือกแถวนั้นก่อนนำเข้า",
        );
    });

    it("keeps the mapping action enabled for a PREVIEW row while employee data is loading", async () => {
        let resolveReference: ((value: Response) => void) | undefined;
        const pendingReference = new Promise<Response>((resolve) => {
            resolveReference = resolve;
        });
        const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith("/imports/reference")) return pendingReference;
            if (url.includes("/preview")) return response({ batch: { id: 1 }, reusedExisting: false });
            if (url.includes("/rows")) return response({
                rows: [editableRow],
                pagination: { page: 1, limit: 25, total: 1, pages: 1 },
            });
            if (url.endsWith("/imports/1")) return response({ batch: {
                ...batch,
                status: "PREVIEW",
                totalRows: 1,
                reviewRows: 1,
                selectedRows: 1,
                unresolvedOwnerRows: 1,
            } });
            return response({ units: [], categories: [], employees: [] });
        });
        vi.stubGlobal("fetch", fetchMock);

        render(<RoutineImportPanel />);
        selectUploadFile();
        fireEvent.click(screen.getByRole("button", { name: /อัปโหลดและดูตัวอย่าง/ }));

        const editButton = await screen.findByRole("button", { name: "แก้ไขและ map ผู้รับผิดชอบ" });
        expect(editButton).toBeEnabled();
        fireEvent.click(editButton);

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

        resolveReference?.(response(reference));
        expect(await screen.findByRole("dialog")).toBeInTheDocument();
    });

    it("reloads import reference when starting a new batch", async () => {
        let previewAttempt = 0;
        let referenceAttempts = 0;
        const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith("/imports/reference")) {
                referenceAttempts += 1;
                return response(reference);
            }
            if (url.includes("/preview")) {
                previewAttempt += 1;
                return response({ batch: { id: previewAttempt }, reusedExisting: false });
            }
            if (url.includes("/rows")) return response({
                rows: [],
                pagination: { page: 1, limit: 25, total: 0, pages: 1 },
            });
            if (url.endsWith("/imports/1")) return response({ batch: { ...batch, id: 1 } });
            if (url.endsWith("/imports/2")) return response({ batch: { ...batch, id: 2 } });
            return response({ error: "unexpected request" }, false);
        });
        vi.stubGlobal("fetch", fetchMock);

        render(<RoutineImportPanel />);
        selectUploadFile();
        fireEvent.click(screen.getByRole("button", { name: /อัปโหลดและดูตัวอย่าง/ }));
        await waitFor(() => expect(referenceAttempts).toBe(1));

        fireEvent.click(screen.getByRole("button", { name: "อัปโหลดไฟล์ใหม่" }));
        selectUploadFile();
        fireEvent.click(screen.getByRole("button", { name: /อัปโหลดและดูตัวอย่าง/ }));

        await waitFor(() => expect(referenceAttempts).toBe(2));
    });

    it("rejects an incomplete employee reference response and keeps the editor closed", async () => {
        const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith("/imports/reference")) return response({
                ...reference,
                employees: [{
                    id: 42,
                    firstName: "สมชาย",
                    lastName: "ใจดี",
                    nickname: "ชาย",
                    departmentId: 1,
                    deletedAt: null,
                }],
            });
            if (url.includes("/preview")) return response({ batch: { id: 1 }, reusedExisting: false });
            if (url.includes("/rows")) return response({
                rows: [editableRow],
                pagination: { page: 1, limit: 25, total: 1, pages: 1 },
            });
            if (url.endsWith("/imports/1")) return response({ batch: { ...batch, totalRows: 1, reviewRows: 1 } });
            return response({ error: "unexpected request" }, false);
        });
        vi.stubGlobal("fetch", fetchMock);

        render(<RoutineImportPanel />);
        selectUploadFile();
        fireEvent.click(screen.getByRole("button", { name: /อัปโหลดและดูตัวอย่าง/ }));
        const editButton = await screen.findByRole("button", { name: /แก้ไขและ map ผู้รับผิดชอบ/ });
        fireEvent.click(editButton);

        expect(await screen.findByText(/ข้อมูลอ้างอิงสำหรับนำเข้าไม่ถูกต้อง/)).toBeInTheDocument();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /ลองโหลดข้อมูลอ้างอิงใหม่/ })).toBeEnabled();
    });

    it("enables Apply when at least one valid row is selected without requiring every valid row", async () => {
        vi.stubGlobal("fetch", importFetchMock(validRow, undefined, {
            totalRows: 2,
            validRows: 2,
            selectedRows: 1,
            selectedValidRows: 1,
        }));

        render(<RoutineImportPanel />);
        selectUploadFile();
        fireEvent.click(screen.getByRole("button", { name: /อัปโหลดและดูตัวอย่าง/ }));

        expect(await screen.findByRole("button", { name: /ยืนยันและนำเข้า/ })).toBeEnabled();
    });

    it("closes a stale editor and reloads the latest row after an optimistic conflict", async () => {
        const latestRow = {
            ...editableRow,
            version: 2,
            data: {
                ...editableRow.data,
                title: "ข้อมูลล่าสุดจากผู้ดูแลอีกคน",
            },
        } satisfies RoutineImportRowView;
        let rowsRequestCount = 0;
        const fetchMock = vi.fn().mockImplementation(async (
            input: RequestInfo | URL,
            init?: RequestInit,
        ) => {
            const url = String(input);
            if (init?.method === "PATCH") {
                return {
                    ok: false,
                    status: 409,
                    json: async () => ({ error: "รายการถูกเปลี่ยนแปลงแล้ว" }),
                } as Response;
            }
            if (url.endsWith("/imports/reference")) return response(reference);
            if (url.includes("/preview")) return response({ batch: { id: 1 }, reusedExisting: false });
            if (url.includes("/rows")) {
                rowsRequestCount += 1;
                return response({
                    rows: [rowsRequestCount === 1 ? editableRow : latestRow],
                    pagination: { page: 1, limit: 25, total: 1, pages: 1 },
                });
            }
            if (url.endsWith("/imports/1")) return response({
                batch: { ...batch, totalRows: 1, reviewRows: 1, selectedRows: 1 },
            });
            return response({ error: "unexpected request" }, false);
        });
        vi.stubGlobal("fetch", fetchMock);

        render(<RoutineImportPanel />);
        selectUploadFile();
        fireEvent.click(screen.getByRole("button", { name: /อัปโหลดและดูตัวอย่าง/ }));
        fireEvent.click(await screen.findByRole("button", { name: /แก้ไข/ }));
        fireEvent.change(screen.getByDisplayValue("ตรวจสอบรายการนำเข้า"), {
            target: { value: "ค่าที่ stale" },
        });
        fireEvent.click(screen.getByRole("button", { name: /บันทึกแถว/ }));

        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(await screen.findByText("ข้อมูลล่าสุดจากผู้ดูแลอีกคน")).toBeInTheDocument();
        expect(screen.queryByDisplayValue("ค่าที่ stale")).not.toBeInTheDocument();
    });

    it("can retry the employee reference request when the first load fails", async () => {
        let referenceAttempts = 0;
        const fetchMock = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith("/imports/reference")) {
                referenceAttempts += 1;
                return referenceAttempts === 1
                    ? response({ error: "โหลดข้อมูลพนักงานไม่สำเร็จ" }, false)
                    : response(reference);
            }
            if (url.includes("/preview")) return response({ batch: { id: 1 }, reusedExisting: false });
            if (url.includes("/rows")) return response({
                rows: [editableRow],
                pagination: { page: 1, limit: 25, total: 1, pages: 1 },
            });
            if (url.endsWith("/imports/1")) return response({ batch: { ...batch, totalRows: 1, reviewRows: 1 } });
            return response({ units: [], categories: [], employees: [] });
        });
        vi.stubGlobal("fetch", fetchMock);

        render(<RoutineImportPanel />);
        selectUploadFile();
        fireEvent.click(screen.getByRole("button", { name: /อัปโหลดและดูตัวอย่าง/ }));

        const editButton = await screen.findByRole("button", { name: "แก้ไขและ map ผู้รับผิดชอบ" });
        expect(editButton).toBeEnabled();
        fireEvent.click(editButton);

        expect(await screen.findByRole("dialog")).toBeInTheDocument();
    });
});
