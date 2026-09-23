import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toastMocks = vi.hoisted(() => ({
    success: vi.fn(),
    error: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: toastMocks }));

import { RoutineImportPanel } from "./RoutineImportPanel";
import type { RoutineImportRowView } from "./import-types";

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

    it("keeps the newest batch and rows when an older filtered request fails later", async () => {
        const batchRequests: ReturnType<typeof createDeferred<Response>>[] = [];
        const rowRequests = new Map<string, ReturnType<typeof createDeferred<Response>>>();
        let deferFilteredQueries = false;
        const fetchMock = vi.fn((input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes("/preview")) {
                return Promise.resolve(response({ batch: { id: 1 }, reusedExisting: false }));
            }
            if (url.endsWith("/imports/reference")) return Promise.resolve(response(reference));
            if (url.includes("/rows")) {
                if (deferFilteredQueries) {
                    const search = new URL(url, "http://localhost").search;
                    const request = createDeferred<Response>();
                    rowRequests.set(search, request);
                    return request.promise;
                }
                return Promise.resolve(response({
                    rows: [validRow],
                    pagination: { page: 1, limit: 25, total: 1, pages: 1 },
                }));
            }
            if (url.endsWith("/imports/1")) {
                if (deferFilteredQueries) {
                    const request = createDeferred<Response>();
                    batchRequests.push(request);
                    return request.promise;
                }
                return Promise.resolve(response({ batch: { ...batch, totalRows: 1, selectedRows: 1 } }));
            }
            return Promise.resolve(response({ units: [], categories: [], employees: [] }));
        });
        vi.stubGlobal("fetch", fetchMock);

        render(<RoutineImportPanel />);
        selectUploadFile();
        fireEvent.click(screen.getByRole("button", { name: /อัปโหลดและดูตัวอย่าง/ }));
        const statusFilter = await screen.findByLabelText("สถานะ");
        deferFilteredQueries = true;

        fireEvent.change(statusFilter, { target: { value: "VALID" } });
        await waitFor(() => expect(batchRequests).toHaveLength(1));
        fireEvent.change(screen.getByLabelText("ประเด็น"), {
            target: { value: "UNRESOLVED_OWNER" },
        });
        await waitFor(() => expect(batchRequests).toHaveLength(2));

        const newerRowsEntry = [...rowRequests.entries()].find(([search]) => {
            const params = new URLSearchParams(search);
            return params.get("status") === "VALID"
                && params.get("issue") === "UNRESOLVED_OWNER";
        });
        const olderRowsEntry = [...rowRequests.entries()].find(([search]) => {
            const params = new URLSearchParams(search);
            return params.get("status") === "VALID" && params.get("issue") === null;
        });
        expect(newerRowsEntry).toBeDefined();
        expect(olderRowsEntry).toBeDefined();

        const newerRow = {
            ...validRow,
            data: { ...validRow.data, title: "แถวจาก query ล่าสุด" },
        };
        await act(async () => {
            batchRequests[1]?.resolve(response({
                batch: { ...batch, totalRows: 2, selectedRows: 2 },
            }));
            newerRowsEntry?.[1].resolve(response({
                rows: [newerRow],
                pagination: { page: 1, limit: 25, total: 1, pages: 1 },
            }));
        });

        expect(await screen.findByText("แถวจาก query ล่าสุด")).toBeInTheDocument();
        const selectedCount = screen.getByText("เลือกไว้สำหรับนำเข้า").parentElement?.querySelectorAll("p")[1];
        expect(selectedCount).toHaveTextContent("2");

        await act(async () => {
            batchRequests[0]?.resolve(response({ batch: { ...batch, totalRows: 1, selectedRows: 1 } }));
            olderRowsEntry?.[1].resolve(response({ error: "stale query error" }, false));
        });

        expect(screen.getByText("แถวจาก query ล่าสุด")).toBeInTheDocument();
        expect(
            screen.getByText("เลือกไว้สำหรับนำเข้า").parentElement?.querySelectorAll("p")[1],
        ).toHaveTextContent("2");
        expect(screen.queryByText("stale query error")).not.toBeInTheDocument();
    });

    it("does not let a delayed old batch request replace a newly uploaded batch or consume its toast", async () => {
        const oldBatchRequest = createDeferred<Response>();
        const oldRowsRequest = createDeferred<Response>();
        let previewAttempt = 0;
        let delayOldBatch = false;
        let oldBatchStarted = false;
        let oldRowsStarted = false;
        const fetchMock = vi.fn((input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes("/preview")) {
                previewAttempt += 1;
                return Promise.resolve(response({
                    batch: { id: previewAttempt },
                    reusedExisting: false,
                }));
            }
            if (url.endsWith("/imports/reference")) return Promise.resolve(response(reference));
            if (url.includes("/rows")) {
                if (delayOldBatch && url.includes("/imports/1/rows")) {
                    oldRowsStarted = true;
                    return oldRowsRequest.promise;
                }
                if (url.includes("/imports/2/rows")) {
                    return Promise.resolve(response({
                        rows: [{
                            ...validRow,
                            data: { ...validRow.data, title: "แถวจาก batch 2" },
                        }],
                        pagination: { page: 1, limit: 25, total: 1, pages: 1 },
                    }));
                }
                return Promise.resolve(response({
                    rows: [validRow],
                    pagination: { page: 1, limit: 25, total: 1, pages: 1 },
                }));
            }
            if (url.endsWith("/imports/1")) {
                if (delayOldBatch) {
                    oldBatchStarted = true;
                    return oldBatchRequest.promise;
                }
                return Promise.resolve(response({ batch: { ...batch, id: 1 } }));
            }
            if (url.endsWith("/imports/2")) {
                return Promise.resolve(response({
                    batch: { ...batch, id: 2, originalFileName: "second.xlsx" },
                }));
            }
            return Promise.resolve(response({ units: [], categories: [], employees: [] }));
        });
        vi.stubGlobal("fetch", fetchMock);

        render(<RoutineImportPanel />);
        selectUploadFile();
        fireEvent.click(screen.getByRole("button", { name: /อัปโหลดและดูตัวอย่าง/ }));
        await screen.findByText(/routine\.xlsx/);
        await waitFor(() => expect(toastMocks.success).toHaveBeenCalledTimes(1));
        toastMocks.success.mockClear();

        delayOldBatch = true;
        fireEvent.click(screen.getByRole("button", { name: "รีเฟรช" }));
        await waitFor(() => expect(oldBatchStarted && oldRowsStarted).toBe(true));

        fireEvent.click(screen.getByRole("button", { name: "อัปโหลดไฟล์ใหม่" }));
        selectUploadFile();
        fireEvent.click(screen.getByRole("button", { name: /อัปโหลดและดูตัวอย่าง/ }));

        expect(await screen.findByText(/second\.xlsx/)).toBeInTheDocument();
        await waitFor(() => expect(toastMocks.success).toHaveBeenCalledTimes(1));

        await act(async () => {
            oldBatchRequest.resolve(response({ batch: { ...batch, id: 1, originalFileName: "stale.xlsx" } }));
            oldRowsRequest.resolve(response({
                rows: [{ ...validRow, data: { ...validRow.data, title: "แถวเก่าของ batch 1" } }],
                pagination: { page: 1, limit: 25, total: 1, pages: 1 },
            }));
        });

        expect(screen.getByText(/second\.xlsx/)).toBeInTheDocument();
        expect(screen.queryByText("stale.xlsx")).not.toBeInTheDocument();
        expect(screen.getByText("แถวจาก batch 2")).toBeInTheDocument();
        expect(toastMocks.success).toHaveBeenCalledTimes(1);
    });

    it("hides a ready reference immediately while the new batch version reference loads", async () => {
        const nextReference = createDeferred<Response>();
        let batchRequestCount = 0;
        let referenceAttempts = 0;
        let delayNextReference = false;
        const referenceForVersionTwo = {
            ...reference,
            employees: [{
                ...reference.employees[0],
                firstName: "พนักงานใหม่",
                lastName: "ทดสอบ",
                nickname: "ใหม่",
            }],
        };
        const fetchMock = vi.fn((input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes("/preview")) {
                return Promise.resolve(response({ batch: { id: 1 }, reusedExisting: false }));
            }
            if (url.endsWith("/imports/reference")) {
                referenceAttempts += 1;
                if (delayNextReference) return nextReference.promise;
                return Promise.resolve(response(reference));
            }
            if (url.includes("/rows")) {
                return Promise.resolve(response({
                    rows: [editableRow],
                    pagination: { page: 1, limit: 25, total: 1, pages: 1 },
                }));
            }
            if (url.endsWith("/imports/1")) {
                batchRequestCount += 1;
                return Promise.resolve(response({
                    batch: {
                        ...batch,
                        version: batchRequestCount > 1 ? 2 : 1,
                        totalRows: 1,
                        reviewRows: 1,
                    },
                }));
            }
            return Promise.resolve(response({ units: [], categories: [], employees: [] }));
        });
        vi.stubGlobal("fetch", fetchMock);

        render(<RoutineImportPanel />);
        selectUploadFile();
        fireEvent.click(screen.getByRole("button", { name: /อัปโหลดและดูตัวอย่าง/ }));
        fireEvent.click(await screen.findByRole("button", { name: "แก้ไขและ map ผู้รับผิดชอบ" }));
        expect(await screen.findByRole("dialog")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "ปิด" }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

        delayNextReference = true;
        fireEvent.click(screen.getByRole("button", { name: "รีเฟรช" }));
        await waitFor(() => expect(referenceAttempts).toBe(2));

        fireEvent.click(screen.getByRole("button", { name: "แก้ไขและ map ผู้รับผิดชอบ" }));
        await waitFor(() => expect(referenceAttempts).toBe(3));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

        await act(async () => {
            nextReference.resolve(response(referenceForVersionTwo));
        });

        const dialog = await screen.findByRole("dialog");
        fireEvent.change(screen.getByRole("searchbox", { name: "ค้นหาพนักงาน" }), {
            target: { value: "พนักงานใหม่" },
        });
        expect(await screen.findByRole("option", { name: /เพิ่ม พนักงานใหม่ ทดสอบ/ })).toBeInTheDocument();
        expect(dialog).toBeInTheDocument();
    });

    it("keeps the new batch-version reference after older reference requests resolve", async () => {
        const olderReference = createDeferred<Response>();
        const retriedOldReference = createDeferred<Response>();
        const newReference = createDeferred<Response>();
        let batchRequestCount = 0;
        let referenceAttempts = 0;
        const referenceForVersionTwo = {
            ...reference,
            employees: [{
                ...reference.employees[0],
                firstName: "คนใหม่",
                lastName: "ปัจจุบัน",
                nickname: "ล่าสุด",
            }],
        };
        const fetchMock = vi.fn((input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes("/preview")) {
                return Promise.resolve(response({ batch: { id: 1 }, reusedExisting: false }));
            }
            if (url.endsWith("/imports/reference")) {
                referenceAttempts += 1;
                if (referenceAttempts === 1) return olderReference.promise;
                if (referenceAttempts === 2) return retriedOldReference.promise;
                return newReference.promise;
            }
            if (url.includes("/rows")) {
                return Promise.resolve(response({
                    rows: [editableRow],
                    pagination: { page: 1, limit: 25, total: 1, pages: 1 },
                }));
            }
            if (url.endsWith("/imports/1")) {
                batchRequestCount += 1;
                return Promise.resolve(response({
                    batch: {
                        ...batch,
                        version: batchRequestCount > 1 ? 2 : 1,
                        totalRows: 1,
                        reviewRows: 1,
                    },
                }));
            }
            return Promise.resolve(response({ units: [], categories: [], employees: [] }));
        });
        vi.stubGlobal("fetch", fetchMock);

        render(<RoutineImportPanel />);
        selectUploadFile();
        fireEvent.click(screen.getByRole("button", { name: /อัปโหลดและดูตัวอย่าง/ }));
        await screen.findByRole("button", { name: "แก้ไขและ map ผู้รับผิดชอบ" });
        await waitFor(() => expect(referenceAttempts).toBe(1));

        fireEvent.click(screen.getByRole("button", { name: "แก้ไขและ map ผู้รับผิดชอบ" }));
        await waitFor(() => expect(referenceAttempts).toBe(2));
        fireEvent.click(screen.getByRole("button", { name: "รีเฟรช" }));
        await waitFor(() => expect(referenceAttempts).toBe(3));

        await act(async () => {
            newReference.resolve(response(referenceForVersionTwo));
        });
        expect(await screen.findByRole("dialog")).toBeInTheDocument();
        const employeeSearch = screen.getByRole("searchbox", { name: "ค้นหาพนักงาน" });
        fireEvent.change(employeeSearch, { target: { value: "คนใหม่" } });
        expect(await screen.findByRole("option", { name: /เพิ่ม คนใหม่ ปัจจุบัน/ })).toBeInTheDocument();

        await act(async () => {
            retriedOldReference.resolve(response(reference));
            olderReference.resolve(response(reference));
        });

        fireEvent.change(employeeSearch, { target: { value: "สมชาย" } });
        expect(screen.queryByRole("option", { name: /เพิ่ม สมชาย ใจดี/ })).not.toBeInTheDocument();
        fireEvent.change(employeeSearch, { target: { value: "คนใหม่" } });
        expect(screen.getByRole("option", { name: /เพิ่ม คนใหม่ ปัจจุบัน/ })).toBeInTheDocument();
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

        const searchInput = await screen.findByRole("searchbox", { name: "ค้นหาพนักงาน" });
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

    it("protects unsaved row edits when the editor is closed", async () => {
        vi.stubGlobal("fetch", importFetchMock(editableRow));

        render(<RoutineImportPanel />);
        selectUploadFile();
        fireEvent.click(screen.getByRole("button", { name: /อัปโหลดและดูตัวอย่าง/ }));
        fireEvent.click(await screen.findByRole("button", { name: /แก้ไข/ }));

        const titleInput = await screen.findByDisplayValue("ตรวจสอบรายการนำเข้า");
        fireEvent.change(titleInput, { target: { value: "งานที่ยังไม่บันทึก" } });
        fireEvent.click(screen.getByRole("button", { name: "ปิด" }));

        expect(screen.getByRole("alertdialog")).toHaveTextContent("มีข้อมูลที่ยังไม่ได้บันทึก");
        fireEvent.click(screen.getByRole("button", { name: "กลับไปแก้ไข" }));
        expect(screen.getByDisplayValue("งานที่ยังไม่บันทึก")).toBeInTheDocument();
        expect(screen.getByRole("dialog")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "ปิด" }));
        fireEvent.click(screen.getByRole("button", { name: "ออกโดยไม่บันทึก" }));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
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

        const searchInput = await screen.findByRole("searchbox", { name: "ค้นหาพนักงาน" });
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
        fireEvent.change(await screen.findByDisplayValue("ตรวจสอบรายการนำเข้า"), {
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

    it("debounces import row search and clears back to the unfiltered request", async () => {
        const fetchMock = importFetchMock(editableRow);
        vi.stubGlobal("fetch", fetchMock);

        render(<RoutineImportPanel />);
        selectUploadFile();
        fireEvent.click(screen.getByRole("button", { name: /อัปโหลดและดูตัวอย่าง/ }));

        const searchInput = await screen.findByRole("searchbox", { name: "ค้นหา" });
        const rowRequests = (): string[] => fetchMock.mock.calls
            .map(([input]) => String(input))
            .filter((url) => url.includes("/imports/1/rows?"));
        const initialRequestCount = rowRequests().length;

        fireEvent.change(searchInput, { target: { value: "ต" } });
        fireEvent.change(searchInput, { target: { value: "ตร" } });
        fireEvent.change(searchInput, { target: { value: "ตรวจสอบ" } });
        expect(rowRequests()).toHaveLength(initialRequestCount);

        await waitFor(() => {
            const latestUrl = rowRequests().at(-1);
            expect(latestUrl ? new URL(latestUrl, "http://localhost").searchParams.get("search") : null).toBe("ตรวจสอบ");
        });

        const searchedRequestCount = rowRequests().length;
        fireEvent.click(
            screen.getByRole("button", {
                name: "ล้างคำค้นหารายการนำเข้า",
            }),
        );
        expect(searchInput).toHaveValue("");
        await waitFor(() => {
            const latestUrl = rowRequests().at(-1);
            expect(latestUrl ? new URL(latestUrl, "http://localhost").searchParams.get("search") : null).toBeNull();
        });
        expect(rowRequests()).toHaveLength(searchedRequestCount + 1);
    });
});
