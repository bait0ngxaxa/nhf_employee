import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "sonner";
import { SessionProvider } from "../components/auth/SessionProvider";
import { SWRProvider } from "../components/providers/SWRProvider";

const googleSans = localFont({
    src: "../public/fonts/GoogleSans-VariableFont.woff2",
    variable: "--font-google-sans",
    weight: "100 900",
    display: "swap",
});

export const metadata: Metadata = {
    title: "NHFapp",
    description:
        "ระบบบริหารจัดการทรัพยากรบุคคลและไอที NHF (NHFapp)",
};

export const viewport: Viewport = {
    themeColor: "#ffffff",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="th" suppressHydrationWarning>
            <body className={`${googleSans.variable} antialiased`}>
                {/* Skip-to-content for keyboard/screen reader users */}
                <a
                    href="#main"
                    className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-indigo-600 focus:shadow-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                    ข้ามไปเนื้อหาหลัก
                </a>
                <SessionProvider>
                    <SWRProvider>
                        {children}
                        <Toaster 
                            position="top-right"
                            richColors
                            closeButton
                            duration={4000}
                            toastOptions={{
                                style: {
                                    fontFamily: 'var(--font-google-sans), ui-sans-serif, system-ui, sans-serif',
                                },
                            }}
                        />
                    </SWRProvider>
                </SessionProvider>
            </body>
        </html>
    );
}
