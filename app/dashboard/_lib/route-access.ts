import { redirect } from "next/navigation";

import { getApiAuthSession } from "@/lib/auth/server";
import { isAdminRole } from "@/lib/ssot/permissions";
import { APP_ROUTES } from "@/lib/ssot/routes";

export async function requireDashboardAdmin(): Promise<void> {
    const session = await getApiAuthSession();

    if (!session) {
        redirect(APP_ROUTES.login);
    }

    if (!isAdminRole(session.user.role)) {
        redirect(APP_ROUTES.accessDenied);
    }
}
