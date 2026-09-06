// Notification server/application contracts.
export {
    listLatestForUser,
    listHistoryForUser,
} from "./application/queries";
export {
    markReadForUser,
    markAllReadForUser,
    markUnreadByReferenceForUser,
    createForUser,
    createForUserOnce,
    createForUsers,
} from "./application/commands";
export type {
    NotificationCreateInput,
    NotificationHistoryQuery,
    NotificationHistoryResult,
    NotificationLatestResult,
    NotificationPersistenceContext,
    NotificationReadTransitionInput,
} from "./application/types";
