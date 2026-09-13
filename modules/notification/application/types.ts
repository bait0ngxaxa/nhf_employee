import type { Notification, NotificationType, Prisma } from "@prisma/client";

export type NotificationPersistenceContext = Pick<
    Prisma.TransactionClient,
    "notification"
>;

export type NotificationCreateInput = {
    userId: number;
    type: NotificationType;
    title: string;
    message: string;
    actionUrl: string | null;
    referenceId: string | null;
    dedupeKey?: string | null;
};

export type NotificationReadTransitionInput = {
    userId: number;
    type: NotificationType;
    referenceId: string;
};

export type NotificationHistoryQuery = {
    userId: number;
    filter?: string | null;
    cursor?: string | null;
};

export type NotificationHistoryCursor =
    | {
          kind: "legacy-timestamp";
          createdAt: Date;
      }
    | {
          kind: "composite";
          createdAt: Date;
          id: string;
      };

export type NotificationLatestResult = {
    notifications: Notification[];
    unreadCount: number;
};

export type NotificationHistoryResult = {
    notifications: Notification[];
    nextCursor: string | null;
    hasMore: boolean;
    totalCount: number;
};
export interface NotificationPresentationCapabilities {
    readonly canReadInbox: boolean;
    readonly canUpdateInbox: boolean;
}
