"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export function HeroSection() {
    return (
        <section className="flex min-h-screen flex-col items-center justify-center px-6 pt-20 pb-32 text-center overflow-x-hidden">
            <motion.div
                initial={{ opacity: 0, y: 32 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                    duration: 0.8,
                    ease: [0.22, 1, 0.36, 1],
                    delay: 0.1,
                }}
                className="max-w-5xl"
            >
                <p
                    className="mb-6 text-sm font-semibold uppercase tracking-widest"
                    style={{ color: "#B0232A" }}
                >
                    AI 시간표 추천 서비스
                </p>

                <h1 className="text-balance text-5xl font-semibold leading-[1.1] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
                    시간표 짜기,
                    <br />
                    서간표와 함께하세요.
                </h1>

                <p className="mx-auto mt-8 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
                    AI가 당신의 커리어와 수강이력을 분석해 맞춤 시간표를
                    추천합니다.
                </p>

                <div className="mt-12 flex items-center justify-center">
                    <Link
                        href="/signup"
                        className="group relative inline-flex items-center gap-2 rounded-full px-9 py-4 text-base font-semibold text-white shadow-lg shadow-[#B0232A]/30 transition-all duration-300 hover:shadow-xl hover:shadow-[#B0232A]/40 hover:-translate-y-0.5 active:translate-y-0"
                        style={{ backgroundColor: "#B0232A" }}
                    >
                        <span className="absolute inset-0 rounded-full bg-gradient-to-b from-white/15 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                        <span className="relative">지금 시작하기</span>
                        <ArrowRight className="relative h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                    </Link>
                </div>
            </motion.div>

            {/* 실제 화면 mockup — 노트북 + 폰 합본 이미지 */}
            <motion.div
                initial={{ opacity: 0, y: 48 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                    duration: 1,
                    ease: [0.22, 1, 0.36, 1],
                    delay: 0.35,
                }}
                className="mt-20 w-full max-w-5xl mx-auto px-4"
            >
                <Image
                    src="/landing/laptop_phone.png"
                    alt="서간표 데시보드 — 노트북과 모바일"
                    width={2400}
                    height={1500}
                    priority
                    className="h-auto w-full select-none drop-shadow-xl"
                />
            </motion.div>
        </section>
    );
}
