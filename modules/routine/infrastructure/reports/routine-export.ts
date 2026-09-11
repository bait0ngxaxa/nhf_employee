import { generateFilename } from "@/lib/helpers/date-helpers";
import { createXlsxDownloadResponse } from "@/lib/server/xlsx";
import { EXPORT_LIMITS } from "@/lib/ssot/exports";

import {
    getRoutineTaskWorkItems,
    type SerializedRoutineTaskWorkItem,
} from "../../application/queries";
import type { RoutineQueryActor } from "../../application/types";
import { createRoutineTaskExportWorkbook } from "./routine-workbook";

export type RoutineExportPreparation =
    | { status: "limit-exceeded"; recordCount: number; maxRows: number }
    | { status: "ready"; recordCount: number; response: Response };

export async function prepareRoutineTaskExport(
    queryActor: RoutineQueryActor,
): Promise<RoutineExportPreparation> {
    const pageSize = EXPORT_LIMITS.routine.batchSize;
    const firstPage = await getRoutineTaskWorkItems(
        { scope: "all", page: 1, limit: pageSize },
        queryActor,
        { authorizationMode: "DEFERRED_EXPORT" },
    );
    const recordCount = firstPage.pagination.total;
    if (recordCount > EXPORT_LIMITS.routine.maxRows) {
        return {
            status: "limit-exceeded",
            recordCount,
            maxRows: EXPORT_LIMITS.routine.maxRows,
        };
    }

    const tasks: SerializedRoutineTaskWorkItem[] = [...firstPage.tasks];
    for (let page = 2; page <= firstPage.pagination.pages; page += 1) {
        const nextPage = await getRoutineTaskWorkItems(
            { scope: "all", page, limit: pageSize },
            queryActor,
            { authorizationMode: "DEFERRED_EXPORT" },
        );
        tasks.push(...nextPage.tasks);
    }

    const workbook = createRoutineTaskExportWorkbook(tasks);
    const response = await createXlsxDownloadResponse(
        generateFilename("รายการงานประจำ", "xlsx"),
        workbook,
    );
    return { status: "ready", recordCount, response };
}
