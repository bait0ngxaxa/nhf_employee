import type { ReactElement } from "react";

import { EmployeeManagementSectionSkeleton } from "@/components/employee/EmployeeSkeletons";

export default function EmployeesLoading(): ReactElement {
    return <EmployeeManagementSectionSkeleton />;
}
