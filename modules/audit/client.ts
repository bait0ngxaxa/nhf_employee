"use client";

// Client-safe route-facing Audit presentation entry point.
export { AuditLogsSection } from "./presentation/dashboard/AuditLogsSection";
export {
    AuditLogsSectionSkeleton,
} from "./presentation/dashboard/AuditLogSkeletons";

// Pure display formatter used by existing cross-capability presentation tests.
export { formatAuditLogDisplay } from "./presentation/dashboard/display";
export type { AuditPresentationCapabilities } from "./application/types";
