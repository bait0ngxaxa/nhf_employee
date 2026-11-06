export function triggerDownload(url: string, filename?: string): void {
    if (typeof document === "undefined") {
        return;
    }

    const link = document.createElement("a");
    link.href = url;
    if (filename) link.download = filename;
    link.rel = "noopener";
    link.style.display = "none";

    document.body.appendChild(link);
    try {
        link.click();
    } finally {
        document.body.removeChild(link);
    }
}
