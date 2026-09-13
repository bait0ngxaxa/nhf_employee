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
export {
    assertNotificationCapabilityForMigration,
    assertNotificationCapabilityScope,
    buildNotificationAuthorizationActor,
    buildNotificationAuthorizationContext,
    NotificationCapabilityDeniedError,
    NOTIFICATION_MIGRATED_CAPABILITIES,
    resolveNotificationCapabilityForMigration,
} from "./application/authorization";
export type {
    NotificationAuthorizationActor,
    NotificationAuthorizationContext,
    NotificationCapabilityAuthorization,
    NotificationMigratedCapability,
} from "./application/authorization";
export type {
    NotificationCreateInput,
    NotificationHistoryQuery,
    NotificationHistoryResult,
    NotificationLatestResult,
    NotificationPersistenceContext,
    NotificationReadTransitionInput,
} from "./application/types";
