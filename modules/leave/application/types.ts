export interface LeavePresentationCapabilities {
    readonly canReadOwnRequests: boolean;
    readonly canReadAssignedApprovals: boolean;

    readonly canCreateOwnRequests: boolean;
    readonly canCancelOwnRequests: boolean;

    readonly canApproveAssignedRequests: boolean;
    readonly canDecideAssignedCancellations: boolean;

    readonly canRequestOwnNotTaken: boolean;
    readonly canConfirmAssignedNotTaken: boolean;

    readonly canManageApprovers: boolean;
}
