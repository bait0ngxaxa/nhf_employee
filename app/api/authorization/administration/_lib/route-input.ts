import { badRequest } from "@/lib/ssot/http";

export function parseAdministrationId(
    value: string,
): { readonly ok: true; readonly id: number } | {
    readonly ok: false;
    readonly response: ReturnType<typeof badRequest>;
} {
    const id = Number(value);
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(id) || id <= 0) {
        return {
            ok: false,
            response: badRequest({ code: "INVALID_IDENTIFIER" }),
        };
    }

    return { ok: true, id };
}
