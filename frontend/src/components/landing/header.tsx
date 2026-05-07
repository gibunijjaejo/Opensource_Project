"use client"

import Link from "next/link"
import { motion } from "framer-motion"
import { BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/layout/theme-toggle"

export function Header() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="fixed top-0 inset-x-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <BookOpen className="h-5 w-5" style={{ color: "#B0232A" }} />
          <span className="text-xl font-semibold tracking-tight text-foreground font-logo">
            서간표
          </span>
        </Link>
        <nav className="flex items-center gap-5">
          <Link
            href="/login"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            로그인
          </Link>
          <Button
            asChild
            size="sm"
            className="rounded-full px-5 text-white hover:opacity-90"
            style={{ backgroundColor: "#B0232A" }}
          >
            <Link href="/signup">회원가입</Link>
          </Button>
          <ThemeToggle />
        </nav>
      </div>
    </motion.header>
  )
}
