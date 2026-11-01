"use client";

import useSWR, { type SWRResponse } from "swr";
import { getBusinessDate } from "../domain/business-date";
import { isSupportedHolidayYear, type HolidayReference } from "../schemas/holiday-reference";
import { fetchHolidayReference, HolidayReferenceClientError, type HolidayReferenceChannel } from "./holiday-reference-client";

export function useHolidayReference(channel: HolidayReferenceChannel, year: number): SWRResponse<HolidayReference, unknown> & { supported: boolean } {
    const supported = isSupportedHolidayYear(year, getBusinessDate(new Date()).year);
    const result = useSWR<HolidayReference, unknown>(supported ? ["holiday-reference", channel, year] : null,
        async () => {
            const data = await fetchHolidayReference(channel, year);
            if (data.year !== year) throw new HolidayReferenceClientError(true);
            return data;
        }, { revalidateOnFocus: false, shouldRetryOnError: false, dedupingInterval: 86400000 });
    return { ...result, supported };
}
