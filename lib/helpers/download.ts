export function triggerDownload(url: string): void {
    if (typeof document === "undefined") {
        return;
    }

    const link = document.createElement("a");
    link.href = url;
    link.rel = "noopener";
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
