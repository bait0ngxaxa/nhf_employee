/**
 * Utility functions for file validation including Magic Bytes and MIME types
 */

// Common MIME types and their typical Magic Bytes (Hex signatures)
export const ALLOWED_FILE_TYPES = {
    CSV: {
        mime: ["text/csv", "application/vnd.ms-excel", "text/plain"],
        extensions: [".csv"],
    },
};

/**
 * Validates if a file is a valid CSV by checking its extension, MIME type,
 * and performing a basic heuristic "magic byte" / text content check.
 *
 * Since CSVs are plain text files, they don't have a strict magic byte header
 * like PDFs or images (e.g., %PDF, \xFF\xD8).
 * Instead, we check that it doesn't start with common binary executable signatures
 * and mostly contains printable characters.
 */
export async function validateCSVFile(file: File): Promise<{
    isValid: boolean;
    error?: string;
}> {
    // 1. Extension validation
    const extMatch = ALLOWED_FILE_TYPES.CSV.extensions.some((ext) =>
        file.name.toLowerCase().endsWith(ext),
    );
    if (!extMatch) {
        return { isValid: false, error: "ไฟล์ต้องมีนามสกุล .csv เท่านั้น" };
    }

    // 2. MIME Type validation
    // Some OS/browsers might return empty string for CSVs, so we allow empty but check strictly if present
    if (file.type && !ALLOWED_FILE_TYPES.CSV.mime.includes(file.type)) {
        return {
            isValid: false,
            error: "ประเภทไฟล์ (MIME Type) ไม่ถูกต้องสำหรับ CSV",
        };
    }

    // 3. Basic "Magic Byte" / Signature heuristic check for plain text (CSV)
    try {
        // Read just the first few bytes (e.g., 512 bytes)
        const slice = file.slice(0, 512);
        const buffer = await slice.arrayBuffer();
        const arr = new Uint8Array(buffer);

        // Check for common binary magic bytes that should NOT be in a CSV
        // For example:
        // PDF: 25 50 44 46 (%PDF)
        // ZIP/DOCX: 50 4B 03 04 (PK..)
        // PNG: 89 50 4E 47 (.PNG)
        if (arr.length >= 4) {
            const hexSignature = Array.from(arr.slice(0, 4))
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("")
                .toUpperCase();

            const forbiddenSignatures = [
                "25504446", // PDF
                "504B0304", // ZIP, DOCX, XLSX
                "89504E47", // PNG
                "FFD8FFE0", // JPEG
                "FFD8FFE1", // JPEG
                "MZ", // Windows EXE (4D5A) -> we'll check hex
                "4D5A", // EXE
                "7F454C46", // ELF (Linux executable)
            ];

            // If it starts with a forbidden binary signature, reject
            if (
                forbiddenSignatures.some((sig) => hexSignature.startsWith(sig))
            ) {
                return {
                    isValid: false,
                    error: "ตรวจพบ Magic Byte พื้นฐานที่ไม่ใช่ไฟล์ข้อความ (CSV)",
                };
            }
        }

        // Basic check for null bytes which shouldn't be in a standard CSV (except UTF-16/32, but typically UTF-8 is used)
        // If we find lots of null bytes in the first block, it's likely a binary file masquerading as CSV
        let nullByteCount = 0;
        for (let i = 0; i < arr.length; i++) {
            if (arr[i] === 0x00) nullByteCount++;
        }

        // If more than a reasonable threshold (e.g. 10%) are null bytes, reject
        if (arr.length > 0 && nullByteCount / arr.length > 0.1) {
            return {
                isValid: false,
                error: "โครงสร้างไฟล์มีลักษณะเป็นไฟล์ไบนารี ไม่ใช่ CSV",
            };
        }

        return { isValid: true };
    } catch (err) {
        console.error("File validation reading error:", err);
        return {
            isValid: false,
            error: "ไม่สามารถอ่านโครงสร้างไฟล์เพื่อตรวจสอบได้",
        };
    }
}
