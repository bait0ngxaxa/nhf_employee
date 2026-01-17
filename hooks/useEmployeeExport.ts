import { useState, useCallback } from "react";
import { type Employee, type EmployeeCSVData } from "@/types/employees";

interface UseEmployeeExportReturn {
    allEmployees: Employee[];
    setAllEmployees: (employees: Employee[]) => void;
    isExporting: boolean;
    setIsExporting: (value: boolean) => void;
    prepareCsvData: () => EmployeeCSVData[];
    generateFileName: () => string;
}

export function useEmployeeExport(): UseEmployeeExportReturn {
    const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
    const [isExporting, setIsExporting] = useState(false);

    const prepareCsvData = useCallback((): EmployeeCSVData[] => {
        return allEmployees.map((employee, index) => ({
            ลำดับ: index + 1,
            ชื่อ: employee.firstName,
            นามสกุล: employee.lastName,
            ชื่อเล่น: employee.nickname || "-",
            ตำแหน่ง: employee.position,
            สังกัด: employee.affiliation || "-",
            แผนก: employee.dept.name,
            อีเมล: employee.email,
            เบอร์โทร: employee.phone || "-",
            สถานะ:
                employee.status === "ACTIVE"
                    ? "ทำงานอยู่"
                    : employee.status === "INACTIVE"
                    ? "ไม่ทำงาน"
                    : "ถูกระงับ",
        }));
    }, [allEmployees]);

    const generateFileName = useCallback((): string => {
        const now = new Date();
        const dateStr = now.toLocaleDateString("th-TH").replace(/\//g, "-");
        const timeStr = now
            .toLocaleTimeString("th-TH", { hour12: false })
            .replace(/:/g, "-");
        return `รายชื่อพนักงาน_${dateStr}_${timeStr}.csv`;
    }, []);

    return {
        allEmployees,
        setAllEmployees,
        isExporting,
        setIsExporting,
        prepareCsvData,
        generateFileName,
    };
}
