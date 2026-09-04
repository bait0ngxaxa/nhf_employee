import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { getRoutineXlsxContainerIssue } from "./xlsx-safety";

function writeUint16(bytes: Uint8Array, offset: number, value: number): void {
    new DataView(bytes.buffer).setUint16(offset, value, true);
}

function writeUint32(bytes: Uint8Array, offset: number, value: number): void {
    new DataView(bytes.buffer).setUint32(offset, value, true);
}

function buildZipContainer(options: {
    compressedSize?: number;
    uncompressedSize?: number;
    flags?: number;
} = {}): Uint8Array {
    const centralDirectorySize = 46;
    const endOfCentralDirectoryOffset = centralDirectorySize;
    const bytes = new Uint8Array(endOfCentralDirectoryOffset + 22);
    writeUint32(bytes, 0, 0x02014b50);
    writeUint16(bytes, 8, options.flags ?? 0);
    writeUint32(bytes, 20, options.compressedSize ?? 1);
    writeUint32(bytes, 24, options.uncompressedSize ?? 1);
    writeUint32(bytes, endOfCentralDirectoryOffset, 0x06054b50);
    writeUint16(bytes, endOfCentralDirectoryOffset + 8, 1);
    writeUint16(bytes, endOfCentralDirectoryOffset + 10, 1);
    writeUint32(bytes, endOfCentralDirectoryOffset + 12, centralDirectorySize);
    writeUint32(bytes, endOfCentralDirectoryOffset + 16, 0);
    return bytes;
}

describe("routine xlsx container safety", () => {
    it("accepts a normal xlsx workbook", () => {
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(
            workbook,
            XLSX.utils.aoa_to_sheet([["มสช."]]),
            "มสช.",
        );
        const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });

        expect(getRoutineXlsxContainerIssue(new Uint8Array(bytes))).toBeNull();
    });

    it("rejects encrypted and ZIP64 containers before parsing", () => {
        expect(getRoutineXlsxContainerIssue(buildZipContainer({ flags: 1 }))).toContain("เข้ารหัส");
        expect(getRoutineXlsxContainerIssue(buildZipContainer({ uncompressedSize: 0xffffffff }))).toContain("ZIP64");
    });
});
