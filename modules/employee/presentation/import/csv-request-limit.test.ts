// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
    EMPLOYEE_IMPORT_CSV_MAX_FILE_BYTES,
    EMPLOYEE_IMPORT_JSON_MAX_REQUEST_BYTES,
} from "@/lib/ssot/request-limits";

import { EMPLOYEE_IMPORT_MAX_ROWS } from "../../application/constants";
import { parseCSV } from "./csv";

const encoder = new TextEncoder();
const bytes = (text: string): number => encoder.encode(text).byteLength;

describe("employee import request body limit derivation", () => {
    it("fits the JSON body the UI sends for a maximal 5 MiB, 1,000-row CSV", () => {
        const header = "ชื่อ,นามสกุล,อีเมล,เบอร์โทร,ตำแหน่ง,แผนก,สังกัด,ชื่อเล่น,วันที่เริ่มงาน,สถานะ";
        const fixedColumns = ",2024-01-01,ACTIVE";
        const textColumns = 8;
        const rowBudget = Math.floor(
            (EMPLOYEE_IMPORT_CSV_MAX_FILE_BYTES - bytes(header) - 2) / EMPLOYEE_IMPORT_MAX_ROWS,
        ) - 2; // CRLF per row
        // Backslashes are the worst realistic case: 1 CSV byte -> 2 JSON bytes.
        const fieldBytes = Math.floor(
            (rowBudget - bytes(fixedColumns) - (textColumns - 1)) / textColumns,
        );
        const field = "\\".repeat(fieldBytes);
        const row = Array.from({ length: textColumns }, () => field).join(",") + fixedColumns;
        const csv = [header, ...Array.from({ length: EMPLOYEE_IMPORT_MAX_ROWS }, () => row)].join("\r\n");

        expect(bytes(csv)).toBeLessThanOrEqual(EMPLOYEE_IMPORT_CSV_MAX_FILE_BYTES);
        const employees = parseCSV(csv);
        expect(employees).toHaveLength(EMPLOYEE_IMPORT_MAX_ROWS);

        const jsonBytes = bytes(JSON.stringify({ employees }));
        expect(jsonBytes).toBeGreaterThan(EMPLOYEE_IMPORT_CSV_MAX_FILE_BYTES * 1.9);
        expect(jsonBytes).toBeLessThanOrEqual(EMPLOYEE_IMPORT_JSON_MAX_REQUEST_BYTES);
    });
});
