import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { HybridAuthProvider } from "../components/auth/HybridAuthProvider";
import { SWRProvider } from "../components/providers/SWRProvider";
import { ThemeColorSync } from "../components/providers/ThemeColorSync";
import { ThemeProvider } from "../components/providers/ThemeProvider";
import { ThemeToaster } from "../components/providers/ThemeToaster";

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
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#ffffff" },
        { media: "(prefers-color-scheme: dark)", color: "#18181b" },
    ],
    viewportFit: "cover",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="th" suppressHydrationWarning>
            <body className={`${googleSans.variable} antialiased`}>
                <ThemeProvider
                    attribute="class"
                    themes={["light", "dark"]}
                    defaultTheme="light"
                    enableSystem
                    enableColorScheme
                    disableTransitionOnChange
                >
                    {/* Skip-to-content for keyboard/screen reader users */}
                    <a
                        href="#main"
                        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary focus:shadow-lg focus:ring-2 focus:ring-ring focus:outline-none"
                    >
                        ข้ามไปเนื้อหาหลัก
                    </a>
                    <SWRProvider>
                        <HybridAuthProvider>
                            {children}
                            <ThemeToaster />
                            <ThemeColorSync />
                        </HybridAuthProvider>
                    </SWRProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
