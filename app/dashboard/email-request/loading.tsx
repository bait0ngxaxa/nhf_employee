import type { ReactElement } from "react";

import { EmailRequestSectionSkeleton } from "@/components/dashboard/feedback/EmailRequestSectionSkeleton";

export default function EmailRequestLoading(): ReactElement {
    return <EmailRequestSectionSkeleton />;
}
