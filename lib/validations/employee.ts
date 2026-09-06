// Phase F1 compatibility facade for the existing Employee forms.
// Remove after presentation migrates behind @/modules/employee/client in F2/F3.
export {
    createEmployeeSchema,
    updateEmployeeSchema,
} from "@/modules/employee/client";
export type {
    CreateEmployeeInput,
    UpdateEmployeeInput,
} from "@/modules/employee/client";
