import { getLineLiffId } from "./config";
import { APP_ROUTES } from "@/lib/ssot/routes";

const LIFF_ORIGIN = "https://liff.line.me";

export type LiffSearchParams =
    | URLSearchParams
    | Readonly<Record<string, string | number | boolean | null | undefined>>;

function normalizeLiffPath(pathname: string | undefined): string {
    const input = pathname?.trim() ?? "";
    if (!input || input === APP_ROUTES.line.root) {
        return "";
    }

    const path = input.startsWith(`${APP_ROUTES.line.root}/`)
        ? input.slice(APP_ROUTES.line.root.length)
        : input;

    if (
        !path.startsWith("/")
        || path.startsWith("//")
        || path.includes("\\")
        || path.includes("?")
        || path.includes("#")
        || path.includes("%")
        || path.split("/").some((segment) => segment === "." || segment === "..")
    ) {
        throw new Error("Invalid internal LIFF path");
    }

    return path;
}

function appendSearchParams(
    url: URL,
    searchParams: LiffSearchParams | undefined,
): void {
    if (!searchParams) return;

    if (searchParams instanceof URLSearchParams) {
        searchParams.forEach((value, key) => {
            url.searchParams.append(key, value);
        });
        return;
    }

    for (const [key, value] of Object.entries(searchParams)) {
        if (value !== null && value !== undefined) {
            url.searchParams.set(key, String(value));
        }
    }
}

export function buildLiffUrl(
    pathname?: string,
    searchParams?: LiffSearchParams,
): string {
    const safePath = normalizeLiffPath(pathname);
    const url = new URL(
        `${LIFF_ORIGIN}/${encodeURIComponent(getLineLiffId())}${safePath}`,
    );
    appendSearchParams(url, searchParams);
    return url.toString();
}
