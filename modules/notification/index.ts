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
    assertNotificationCapability,
    assertNotificationCapabilityScope,
    buildNotificationAuthorizationActor,
    buildNotificationAuthorizationContext,
    NotificationCapabilityDeniedError,
    NOTIFICATION_CAPABILITIES,
    getNotificationPresentationCapabilities,
    resolveNotificationCapability,
} from "./application/authorization";
export type {
    NotificationAuthorizationActor,
    NotificationAuthorizationContext,
    NotificationCapabilityAuthorization,
    NotificationCapability,
} from "./application/authorization";
export type { NotificationPresentationCapabilities } from "./application/types";
export type {
    NotificationCreateInput,
    NotificationHistoryQuery,
    NotificationHistoryResult,
    NotificationLatestResult,
    NotificationPersistenceContext,
    NotificationReadTransitionInput,
} from "./application/types";
