export interface StockPresentationCapabilities {
    readonly canReadCatalog: boolean;

    readonly canReadOwnRequests: boolean;
    readonly canReadAllRequests: boolean;
    readonly canCreateRequests: boolean;

    readonly canCancelOwnRequests: boolean;
    readonly canCancelAnyRequests: boolean;
    readonly canProcessRequests: boolean;

    readonly canManageInventory: boolean;
    readonly canExportReports: boolean;
}
