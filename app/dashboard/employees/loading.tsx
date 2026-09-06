import type { ReactElement } from "react";

import { EmployeeManagementSectionSkeleton } from "@/modules/employee/client";

export default function EmployeesLoading(): ReactElement {
    return <EmployeeManagementSectionSkeleton />;
}
