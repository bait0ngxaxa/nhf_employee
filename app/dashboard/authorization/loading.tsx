import { LoadingState } from "@/components/ui/state";

export default function AuthorizationAdministrationLoading(): React.ReactElement {
    return (
        <main className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 sm:py-7 xl:px-8">
            <LoadingState label="กำลังโหลด Authorization Administration" />
        </main>
    );
}
