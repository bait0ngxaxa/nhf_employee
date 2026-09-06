// Notification server/application contracts.
export {
    listLatestForUser,
    listHistoryForUser,
} from "./application/queries";
export {
    markReadForUser,
    markAllReadForUser,
    createForUserOnce,
} from "./application/commands";
export type {
    NotificationCreateInput,
    NotificationHistoryQuery,
    NotificationHistoryResult,
    NotificationLatestResult,
    NotificationPersistenceContext,
} from "./application/types";
