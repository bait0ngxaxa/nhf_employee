import { redirect } from "next/navigation";

import { getCurrentUserProjection } from "@/app/_lib/auth/current-user";
import { isAdminRole } from "@/lib/ssot/permissions";
import { APP_ROUTES } from "@/lib/ssot/routes";

export async function requireDashboardAdmin(): Promise<void> {
    const user = await getCurrentUserProjection();

    if (!user) {
        redirect(APP_ROUTES.login);
    }

    if (!isAdminRole(user.role)) {
        redirect(APP_ROUTES.accessDenied);
    }
}
