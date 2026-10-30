import type { UserContext } from "@/lib/auth/context";
import { AnnouncementError, announcementMutationSchema, type AnnouncementState } from "../domain/contracts";
import { findAnnouncement, persistAnnouncement } from "../infrastructure/persistence/repository";

/** Principal must come from the trusted web session adapter, never request JSON. */
export function assertAnnouncementAdmin(principal: UserContext): void {
    if (principal.role !== "ADMIN") throw new AnnouncementError("FORBIDDEN");
}

export async function getManagedAnnouncement(principal: UserContext): Promise<AnnouncementState> {
    assertAnnouncementAdmin(principal);
    return findAnnouncement();
}

export async function getPublishedAnnouncement(): Promise<{ content: string } | null> {
    const state = await findAnnouncement();
    return state.published ? { content: state.content } : null;
}

export async function mutateAnnouncement(principal: UserContext, input: unknown): Promise<AnnouncementState> {
    assertAnnouncementAdmin(principal);
    const parsed = announcementMutationSchema.safeParse(input);
    if (!parsed.success) throw new AnnouncementError("INVALID_INPUT");
    return persistAnnouncement(principal, parsed.data);
}
