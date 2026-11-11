"use client";

import Link, { useLinkStatus } from "next/link";
import { Loader2 } from "lucide-react";
import type { ComponentProps, ReactElement } from "react";

function NavigationPending(): ReactElement | null {
    const { pending } = useLinkStatus();
    return pending ? <span role="status" className="inline-flex items-center gap-1"><Loader2 aria-hidden="true" className="size-4 animate-spin" /><span className="sr-only">กำลังเปิดหน้า</span></span> : null;
}

/** Forms expose their existing dirty state; modal forms retain their own focus/dismiss guards. */
export function DashboardNavigationLink({ children, ...props }: ComponentProps<typeof Link>): ReactElement {
    return (
        <Link {...props} prefetch={false} scroll={false} onNavigate={(event) => {
            if (document.querySelector('[data-navigation-dirty="true"]')
                && !window.confirm("มีข้อมูลที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?")) {
                event.preventDefault();
                return;
            }
            props.onNavigate?.(event);
        }}>
            {children}
            <NavigationPending />
        </Link>
    );
}
