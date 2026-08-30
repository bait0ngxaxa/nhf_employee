import { requireLiffWorkforceSession } from "@/lib/auth/liff";
import { forbidden } from "@/lib/ssot/http";
import { isAdminRole } from "@/lib/ssot/permissions";

export async function requireLiffStockProcessorSession(): Promise<
    Awaited<ReturnType<typeof requireLiffWorkforceSession>>
> {
    const auth = await requireLiffWorkforceSession();
    if (!auth.ok) return auth;
    if (!isAdminRole(auth.user.role)) {
        return { ok: false, response: forbidden() };
    }
    return auth;
}
