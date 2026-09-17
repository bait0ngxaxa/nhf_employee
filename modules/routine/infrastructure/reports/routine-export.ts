import { generateFilename } from "@/lib/helpers/date-helpers";
import { createXlsxDownloadResponse } from "@/lib/server/xlsx";

import {
    getRoutineTaskExportData,
} from "../../application/queries";
import type { RoutineQueryActor } from "../../application/types";
import { createRoutineTaskExportWorkbook } from "./routine-workbook";

export type RoutineExportPreparation =
    | { status: "limit-exceeded"; recordCount: number; maxRows: number }
    | { status: "ready"; recordCount: number; response: Response };

export async function prepareRoutineTaskExport(
    queryActor: RoutineQueryActor,
): Promise<RoutineExportPreparation> {
    const exportData = await getRoutineTaskExportData(queryActor);
    if (exportData.status === "limit-exceeded") {
        return {
            status: "limit-exceeded",
            recordCount: exportData.recordCount,
            maxRows: exportData.maxRows,
        };
    }

    const workbook = createRoutineTaskExportWorkbook(exportData.tasks);
    const response = await createXlsxDownloadResponse(
        generateFilename("รายการงานประจำ", "xlsx"),
        workbook,
    );
    return {
        status: "ready",
        recordCount: exportData.recordCount,
        response,
    };
}
