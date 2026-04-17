type CsvCell = string | number | boolean | null | undefined;

const encoder = new TextEncoder();
const UTF8_BOM = "\uFEFF";
const ASCII_FALLBACK_FILENAME = "export.csv";

function escapeCsvCell(value: CsvCell): string {
    if (value === null || value === undefined) {
        return "";
    }

    const normalized = String(value);
    if (/[",\r\n]/.test(normalized)) {
        return `"${normalized.replace(/"/g, "\"\"")}"`;
    }

    return normalized;
}

export function encodeCsvRow(cells: CsvCell[]): Uint8Array {
    return encoder.encode(`${cells.map(escapeCsvCell).join(",")}\r\n`);
}

export function createCsvDownloadResponse(
    filename: string,
    producer: (
        controller: ReadableStreamDefaultController<Uint8Array>,
    ) => Promise<void>,
): Response {
    const encodedFilename = encodeURIComponent(filename);
    const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
            controller.enqueue(encoder.encode(UTF8_BOM));

            try {
                await producer(controller);
                controller.close();
            } catch (error) {
                controller.error(error);
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="${ASCII_FALLBACK_FILENAME}"; filename*=UTF-8''${encodedFilename}`,
            "Cache-Control": "no-store",
        },
    });
}
