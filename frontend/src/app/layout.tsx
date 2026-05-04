import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { AdminMessageModal } from "@/components/features/admin-message-modal";

const notoSansKR = Noto_Sans_KR({
    subsets: ["latin"],
    weight: ["400", "500", "700"],
    variable: "--font-noto-sans-kr",
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
        <html lang="ko" suppressHydrationWarning className={notoSansKR.variable}>
            <body className="font-sans antialiased">
                <ThemeProvider
                    attribute="class"
                    defaultTheme="light"
                    enableSystem={false}
                >
                    {children}
                    <AdminMessageModal />
                </ThemeProvider>
            </body>
        </html>
    );
}
