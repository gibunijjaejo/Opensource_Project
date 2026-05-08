"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FadeInSection } from "@/components/landing/fade-in-section";

export function CtaSection() {
    return (
        <section className="bg-secondary/40 py-40 px-6">
            <div className="mx-auto max-w-5xl flex flex-col items-center text-center">
                <FadeInSection>
                    <h2 className="text-balance text-5xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-6xl">
                        지금 시작해보세요.
                    </h2>
                </FadeInSection>

                <FadeInSection delay={0.1}>
                    <p className="mx-auto mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
                        서강대학교 컴퓨터공학과 학생이라면 누구나 무료로 사용할
                        수 있습니다.
                    </p>
                </FadeInSection>

                <FadeInSection delay={0.18}>
                    <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                        <Button
                            asChild
                            size="lg"
                            className="rounded-full px-10 py-6 text-base text-white hover:opacity-90"
                            style={{ backgroundColor: "#B0232A" }}
                        >
                            <Link href="/signup">회원가입</Link>
                        </Button>
                        <Button
                            asChild
                            size="lg"
                            variant="outline"
                            className="rounded-full border-border px-10 py-6 text-base text-foreground hover:bg-secondary"
                        >
                            <Link href="/login">로그인</Link>
                        </Button>
                    </div>
                </FadeInSection>
            </div>
        </section>
    );
}
