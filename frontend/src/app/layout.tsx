import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '서간표',
  description: '수강 이력 기반 시간표 구성 및 강의 추천 서비스',
  icons: {},
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
