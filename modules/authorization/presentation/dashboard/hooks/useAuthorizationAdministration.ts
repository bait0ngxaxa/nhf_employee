import { useMemo } from "react";
import useSWR, { type KeyedMutator } from "swr";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { API_ROUTES } from "@/lib/ssot/routes";

import {
    fetchOverview,
    fetchTeam,
    fetchUser,
    searchUsers,
} from "../api";
import type {
    AuthorizationAdministrationOverviewData,
    AuthorizationAdministrationTeamDetailData,
    AuthorizationAdministrationUserDetailData,
    AuthorizationAdministrationUserSummaryData,
} from "../types";

export interface AuthorizationAdministrationDataState {
    readonly overview: AuthorizationAdministrationOverviewData | undefined;
    readonly overviewError: Error | undefined;
    readonly overviewLoading: boolean;
    readonly refreshOverview: KeyedMutator<AuthorizationAdministrationOverviewData>;
    readonly team: AuthorizationAdministrationTeamDetailData | undefined;
    readonly teamError: Error | undefined;
    readonly teamLoading: boolean;
    readonly refreshTeam: KeyedMutator<AuthorizationAdministrationTeamDetailData>;
    readonly user: AuthorizationAdministrationUserDetailData | undefined;
    readonly userError: Error | undefined;
    readonly userLoading: boolean;
    readonly refreshUser: KeyedMutator<AuthorizationAdministrationUserDetailData>;
    readonly directoryUsers: readonly AuthorizationAdministrationUserSummaryData[] | undefined;
    readonly directoryError: Error | undefined;
    readonly directoryLoading: boolean;
    readonly refreshDirectory: KeyedMutator<readonly AuthorizationAdministrationUserSummaryData[]>;
}

export function useAuthorizationAdministrationData({
    initialOverview,
    selectedTeamId,
    selectedUserId,
    userSearchQuery,
}: {
    readonly initialOverview?: AuthorizationAdministrationOverviewData;
    readonly selectedTeamId: number | null;
    readonly selectedUserId: number | null;
    readonly userSearchQuery: string;
}): AuthorizationAdministrationDataState {
    const overviewState = useSWR<AuthorizationAdministrationOverviewData>(
        API_ROUTES.authorizationAdministration.overview,
        fetchOverview,
        {
            fallbackData: initialOverview,
            revalidateOnFocus: false,
            shouldRetryOnError: false,
        },
    );

    const teamIdForFetch = selectedTeamId;
    const teamState = useSWR<AuthorizationAdministrationTeamDetailData>(
        teamIdForFetch === null
            ? null
            : API_ROUTES.authorizationAdministration.teamById(teamIdForFetch),
        () => {
            if (teamIdForFetch === null) {
                return Promise.reject(new Error("ยังไม่ได้เลือก Team"));
            }
            return fetchTeam(teamIdForFetch);
        },
        {
            revalidateOnFocus: false,
            shouldRetryOnError: false,
        },
    );

    const userIdForFetch = selectedUserId;
    const userState = useSWR<AuthorizationAdministrationUserDetailData>(
        userIdForFetch === null
            ? null
            : API_ROUTES.authorizationAdministration.userById(userIdForFetch),
        () => {
            if (userIdForFetch === null) {
                return Promise.reject(new Error("ยังไม่ได้เลือก User"));
            }
            return fetchUser(userIdForFetch);
        },
        {
            revalidateOnFocus: false,
            shouldRetryOnError: false,
        },
    );

    const debouncedQuery = useDebouncedValue(userSearchQuery.trim());
    const directoryKey = useMemo(
        () => debouncedQuery.length > 0
            ? API_ROUTES.authorizationAdministration.userSearch(debouncedQuery)
            : null,
        [debouncedQuery],
    );
    const directoryState = useSWR<readonly AuthorizationAdministrationUserSummaryData[]>(
        directoryKey,
        () => searchUsers(debouncedQuery),
        {
            revalidateOnFocus: false,
            shouldRetryOnError: false,
            keepPreviousData: true,
        },
    );

    return {
        overview: overviewState.data,
        overviewError: overviewState.error,
        overviewLoading: overviewState.isLoading,
        refreshOverview: overviewState.mutate,
        team: teamState.data,
        teamError: teamState.error,
        teamLoading: selectedTeamId !== null && teamState.isLoading,
        refreshTeam: teamState.mutate,
        user: userState.data,
        userError: userState.error,
        userLoading: selectedUserId !== null && userState.isLoading,
        refreshUser: userState.mutate,
        directoryUsers: directoryState.data,
        directoryError: directoryState.error,
        directoryLoading: directoryState.isLoading,
        refreshDirectory: directoryState.mutate,
    };
}
