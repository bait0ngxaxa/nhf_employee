import {
    findAccountIdentityById as findAccountIdentity,
    type AuthAccountIdentity,
} from "../infrastructure/persistence/account-repository";

export async function findAccountIdentityById(
    userId: number,
): Promise<AuthAccountIdentity | null> {
    return findAccountIdentity(userId);
}
