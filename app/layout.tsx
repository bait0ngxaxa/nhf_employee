import type { Metadata } from "next";
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
    title: "NHF IT Management System",
    description:
        "ระบบบริหารจัดการทรัพยากรบุคคลและไอที NHF (NHF IT Management System)",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`${googleSans.variable} antialiased`}>
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
