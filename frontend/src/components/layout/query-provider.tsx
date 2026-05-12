"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"

/**
 * 클라이언트 전체에서 공유하는 React Query Provider.
 *
 * 기본 정책:
 *   - staleTime: 5분 — 그 사이엔 백그라운드 refetch 없이 캐시 사용
 *   - gcTime: 30분 — 마지막 구독 해제 후 30분간 메모리 유지 (페이지 이동 후 돌아와도 hit)
 *   - refetchOnWindowFocus: false — 탭 전환 시 자동 refetch 끔 (UX 안정)
 *
 * 각 useQuery 가 필요 시 staleTime 등을 개별로 덮어쓸 수 있다.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  // QueryClient 는 컴포넌트 외부에서 생성하면 SSR 시 모듈 재사용 문제가 있음 → useState 로 한 번만.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 30 * 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  )

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
