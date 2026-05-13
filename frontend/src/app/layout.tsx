import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { QueryProvider } from "@/components/layout/query-provider";
import { AdminMessageModal } from "@/components/features/admin-message-modal";
import { Toaster } from "@/components/ui/sonner";

const notoSansKR = Noto_Sans_KR({
    subsets: ["latin"],
    weight: ["400", "500", "700"],
    variable: "--font-noto-sans-kr",
    display: "swap",
});

const logoFont = localFont({
    src: "../../font/이서윤체.ttf",
    variable: "--font-logo",
    display: "swap",
});

export const metadata: Metadata = {
    title: "서간표",
    description: "수강 이력 기반 시간표 구성 및 강의 추천 서비스",
    icons: {},
};

// 사용자 os 따라가지 않고 일단 라이트로 유지
export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="ko" suppressHydrationWarning className={`${notoSansKR.variable} ${logoFont.variable}`}>
            <body className="font-sans antialiased">
                <QueryProvider>
                    <ThemeProvider
                        attribute="class"
                        defaultTheme="light"
                        enableSystem={false}
                    >
                        {children}
                        <AdminMessageModal />
                        <Toaster position="top-center" richColors />
                    </ThemeProvider>
                </QueryProvider>
            </body>
        </html>
    );
}
