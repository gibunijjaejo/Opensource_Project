import Link from "next/link"
import { BookOpen, Github } from "lucide-react"

export function Footer() {
  return (
    <footer className="border-t border-border bg-background px-6 py-10">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4" style={{ color: "#B0232A" }} />
          <span className="text-sm text-muted-foreground">
            <span className="font-logo text-foreground">서간표</span>
            <span className="mx-2">·</span>
            © 2026 Made by Team Seoganpyo
          </span>
        </div>
        <Link
          href="https://github.com/gibunijjaejo/Opensource_Project"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          aria-label="GitHub 저장소"
        >
          <Github className="h-4 w-4" />
          GitHub
        </Link>
      </div>
    </footer>
  )
}
