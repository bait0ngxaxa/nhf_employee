export function getLineLiffId(): string {
    const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID?.trim();
    if (!liffId) {
        throw new Error("NHFapp LINE LIFF ID is not configured");
    }

    return liffId;
}
