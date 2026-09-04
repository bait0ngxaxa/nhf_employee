import {
    ROUTINE_IMPORT_MAX_XLSX_ENTRIES,
    ROUTINE_IMPORT_MAX_XLSX_UNCOMPRESSED_BYTES,
} from "./sheet-config";

const ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY_SIZE = 22;
const ZIP_MAX_COMMENT_BYTES = 65_535;
const ZIP_MAX_COMPRESSION_RATIO = 1_000;

function readUint16LE(bytes: Uint8Array, offset: number): number {
    return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
    return (
        bytes[offset]
        | (bytes[offset + 1] << 8)
        | (bytes[offset + 2] << 16)
        | (bytes[offset + 3] << 24)
    ) >>> 0;
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
    const firstCandidate = Math.max(
        0,
        bytes.length - ZIP_END_OF_CENTRAL_DIRECTORY_SIZE - ZIP_MAX_COMMENT_BYTES,
    );
    for (
        let offset = bytes.length - ZIP_END_OF_CENTRAL_DIRECTORY_SIZE;
        offset >= firstCandidate;
        offset -= 1
    ) {
        if (readUint32LE(bytes, offset) !== ZIP_END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
            continue;
        }
        const commentLength = readUint16LE(bytes, offset + 20);
        if (offset + ZIP_END_OF_CENTRAL_DIRECTORY_SIZE + commentLength <= bytes.length) {
            return offset;
        }
    }
    return -1;
}

/**
 * Performs a bounded central-directory inspection before SheetJS inflates an
 * .xlsx archive. It intentionally does not extract or execute archive entries.
 */
export function getRoutineXlsxContainerIssue(bytes: Uint8Array): string | null {
    const endOfCentralDirectory = findEndOfCentralDirectory(bytes);
    if (endOfCentralDirectory < 0) return "ไฟล์ .xlsx มีโครงสร้าง ZIP ไม่ถูกต้อง";

    const entryCount = readUint16LE(bytes, endOfCentralDirectory + 10);
    const centralDirectorySize = readUint32LE(bytes, endOfCentralDirectory + 12);
    const centralDirectoryOffset = readUint32LE(bytes, endOfCentralDirectory + 16);

    if (
        entryCount === 0xffff
        || centralDirectorySize === 0xffffffff
        || centralDirectoryOffset === 0xffffffff
    ) {
        return "ไม่รองรับไฟล์ .xlsx ที่ใช้ ZIP64";
    }
    if (entryCount === 0 || entryCount > ROUTINE_IMPORT_MAX_XLSX_ENTRIES) {
        return "ไฟล์ .xlsx มีจำนวนรายการภายในเกินขีดจำกัดที่รองรับ";
    }

    const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
    if (
        centralDirectoryOffset < 0
        || centralDirectoryEnd > endOfCentralDirectory
        || centralDirectoryEnd > bytes.length
    ) {
        return "ไฟล์ .xlsx มีโครงสร้าง ZIP ไม่ถูกต้อง";
    }

    let cursor = centralDirectoryOffset;
    let totalUncompressedBytes = 0;
    for (let index = 0; index < entryCount; index += 1) {
        if (
            cursor + 46 > centralDirectoryEnd
            || readUint32LE(bytes, cursor) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE
        ) {
            return "ไฟล์ .xlsx มีรายการ ZIP ไม่ถูกต้อง";
        }

        const flags = readUint16LE(bytes, cursor + 8);
        const compressedSize = readUint32LE(bytes, cursor + 20);
        const uncompressedSize = readUint32LE(bytes, cursor + 24);
        const fileNameLength = readUint16LE(bytes, cursor + 28);
        const extraFieldLength = readUint16LE(bytes, cursor + 30);
        const commentLength = readUint16LE(bytes, cursor + 32);

        if ((flags & 0x0001) !== 0) return "ไม่รองรับไฟล์ .xlsx ที่ถูกเข้ารหัส";
        if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
            return "ไม่รองรับไฟล์ .xlsx ที่ใช้ ZIP64";
        }

        const entryEnd = cursor + 46 + fileNameLength + extraFieldLength + commentLength;
        if (entryEnd > centralDirectoryEnd) return "ไฟล์ .xlsx มีรายการ ZIP ไม่ถูกต้อง";

        totalUncompressedBytes += uncompressedSize;
        if (totalUncompressedBytes > ROUTINE_IMPORT_MAX_XLSX_UNCOMPRESSED_BYTES) {
            return "ไฟล์ .xlsx มีข้อมูลหลังคลายบีบอัดเกินขีดจำกัดที่รองรับ";
        }
        if (
            compressedSize > 0
            && uncompressedSize / compressedSize > ZIP_MAX_COMPRESSION_RATIO
        ) {
            return "ไฟล์ .xlsx มีอัตราการบีบอัดผิดปกติ";
        }

        cursor = entryEnd;
    }

    return cursor === centralDirectoryEnd
        ? null
        : "ไฟล์ .xlsx มีโครงสร้าง ZIP ไม่ถูกต้อง";
}
