"use client";

import { FadeInSection } from "@/components/landing/fade-in-section";
import { ThumbsUp, MessageCircle, Pin } from "lucide-react";

const posts = [
    {
        category: "AI",
        pinned: true,
        title: "머신러닝 인턴십 후기 모음 (2026 상반기)",
        excerpt:
            "네이버·카카오·삼성SDS 인턴 합격한 선배들 후기 정리해뒀어요. 코테 준비부터 면접 팁까지.",
        likes: 58,
        comments: 12,
    },
    {
        category: "백엔드",
        pinned: false,
        title: "Spring Boot 처음 시작할 때 이거 하나만 보세요",
        excerpt:
            "1학기 동안 강의 들으면서 정리한 학습 로드맵. 프로젝트 예제 깃헙 링크 포함.",
        likes: 42,
        comments: 7,
    },
    {
        category: "DevOps",
        pinned: false,
        title: "Docker·Kubernetes 입문 자료 추천",
        excerpt:
            "유튜브 무료 강의 + 책 두 권만으로 K8s 자격증까지 갈 수 있어요. 진짜 베스트 자료만 골랐습니다.",
        likes: 31,
        comments: 4,
    },
    {
        category: "보안",
        pinned: false,
        title: "정보보안기사 합격 후기 + 공부법",
        excerpt:
            "비전공자도 4개월 안에 가능. 시험 직전 1주일 포인트 공유합니다.",
        likes: 19,
        comments: 6,
    },
];

export function FeatureCommunity() {
    return (
        <section className="bg-background py-40 px-6">
            <div className="mx-auto max-w-5xl">
                <div className="flex flex-col items-center text-center">
                    <FadeInSection>
                        <p
                            className="mb-5 text-xs font-semibold uppercase tracking-widest"
                            style={{ color: "#B0232A" }}
                        >
                            COMMUNITY
                        </p>
                    </FadeInSection>

                    <FadeInSection delay={0.08}>
                        <h2 className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-5xl">
                            관심 분야별 게시판,
                            <br />
                            같은 관심사를 가진 학우들과.
                        </h2>
                    </FadeInSection>

                    <FadeInSection delay={0.15}>
                        <p className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
                            AI, 백엔드, DevOps, 보안 등 14개 트랙별 커뮤니티에서{" "}
                            <br></br>
                            진로·학습 정보를 공유하세요.
                        </p>
                    </FadeInSection>

                    {/* 게시글 카드 */}
                    <FadeInSection delay={0.22} className="mt-16 w-full">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {posts.map((post, i) => (
                                <div
                                    key={i}
                                    className="rounded-2xl border border-border bg-card p-6 text-left transition-colors hover:bg-secondary/30"
                                >
                                    <div className="mb-3 flex items-center gap-2">
                                        <span
                                            className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white"
                                            style={{
                                                backgroundColor: "#B0232A",
                                            }}
                                        >
                                            {post.category}
                                        </span>
                                        {post.pinned && (
                                            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                                                <Pin className="h-2.5 w-2.5" />
                                                고정
                                            </span>
                                        )}
                                        <span className="ml-auto text-xs text-muted-foreground"></span>
                                    </div>

                                    <h3 className="text-base font-semibold text-foreground leading-snug">
                                        {post.title}
                                    </h3>

                                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground line-clamp-2">
                                        {post.excerpt}
                                    </p>

                                    <div className="mt-4 flex items-center gap-4 border-t border-border pt-3">
                                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <ThumbsUp className="h-3.5 w-3.5" />
                                            {post.likes}
                                        </span>
                                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                            <MessageCircle className="h-3.5 w-3.5" />
                                            {post.comments}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </FadeInSection>
                </div>
            </div>
        </section>
    );
}
