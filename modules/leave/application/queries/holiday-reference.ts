import { unstable_cache } from "next/cache";
import { fetchGoogleHolidayReference } from "../../infrastructure/holidays/google-holiday-reference";
import type { HolidayReference } from "../../schemas/holiday-reference";

// Only validated, normalized public reference data is shared. Authentication is
// performed outside this cache in each channel's route; failures are not cached.
const getCachedReference = unstable_cache(
    fetchGoogleHolidayReference,
    ["leave-google-holiday-reference-v1"],
    { revalidate: 86400 },
);

export async function getHolidayReference(year: number): Promise<HolidayReference> {
    return getCachedReference(year);
}
