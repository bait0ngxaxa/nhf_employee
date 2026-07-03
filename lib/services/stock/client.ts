import { apiGet, type ApiResponse } from "@/lib/client/api-client";
import { triggerDownload } from "@/lib/helpers/download";
import { API_ROUTES } from "@/lib/ssot/routes";

export interface StockReportYearsResponse {
    years: number[];
}

export interface StockReportMetaResponse {
    year: number;
    count: number;
    maxRows: number;
}

export interface StockBalanceMetaResponse {
    count: number;
    maxRows: number;
}

const DEFAULT_FETCH_ERROR = "ไม่สามารถดึงข้อมูลได้";

const ensureSuccess = <T>(response: ApiResponse<T>): T => {
    if (!response.success) {
        throw new Error(response.errorThai || response.error || DEFAULT_FETCH_ERROR);
    }
    return response.data;
};

export const fetchStockReportYears = async (): Promise<StockReportYearsResponse> => {
    const response = await apiGet<StockReportYearsResponse>(
        `${API_ROUTES.stock.reportsExport}?yearsOnly=1`,
    );
    return ensureSuccess(response);
};

export const fetchStockReportMeta = async (
    year: number,
): Promise<StockReportMetaResponse> => {
    const response = await apiGet<StockReportMetaResponse>(
        `${API_ROUTES.stock.reportsExport}?metaOnly=1&year=${year}`,
    );
    return ensureSuccess(response);
};

export const fetchStockBalanceMeta = async (): Promise<StockBalanceMetaResponse> => {
    const response = await apiGet<StockBalanceMetaResponse>(
        `${API_ROUTES.stock.reportsExport}?metaOnly=1&reportType=balances`,
    );
    return ensureSuccess(response);
};

export const downloadStockRequestReportFile = (year: number): void => {
    triggerDownload(`${API_ROUTES.stock.reportsExport}?format=xlsx&year=${year}`);
};

export const downloadStockBalanceReportFile = (): void => {
    triggerDownload(`${API_ROUTES.stock.reportsExport}?format=xlsx&reportType=balances`);
};
