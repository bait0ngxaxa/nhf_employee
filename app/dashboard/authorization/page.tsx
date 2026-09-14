import type { Metadata } from "next";

import {
    getAuthorizationAdministrationOverview,
} from "@/modules/authorization";
import { AuthorizationAdministrationWorkspace } from "@/modules/authorization/client";
import { requireDashboardAuthorizationAdministration } from "@/app/dashboard/_lib/route-access";

export const metadata: Metadata = {
    title: "Authorization Administration | NHFapp",
};

export default async function AuthorizationAdministrationPage(): Promise<React.ReactElement> {
    const principal = await requireDashboardAuthorizationAdministration();
    const overview = await getAuthorizationAdministrationOverview(principal);

    return <AuthorizationAdministrationWorkspace initialOverview={overview} />;
}
