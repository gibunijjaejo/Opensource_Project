"use client"

import Link from "next/link"
import { X, FileText, UserCircle, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Course } from "@/lib/constants/course-data"

interface WishlistCardProps {
  course: Course
  onRemove: (id: string) => void
}

export function WishlistCard({ course, onRemove }: WishlistCardProps) {
  
  return (
    <div className="group flex flex-col gap-3 rounded-md border border-border bg-card p-4 transition-shadow hover:shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-mono font-medium text-muted-foreground tracking-wide uppercase">
            {course.code}
          </span>
          <h3 className="text-sm font-semibold text-foreground leading-snug text-balance">
            {course.name}
          </h3>
        </div>
        <button
          onClick={() => onRemove(course.id)}
          className="mt-0.5 flex-shrink-0 rounded p-0.5 text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
          aria-label={`${course.name} 삭제`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <UserCircle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{course.professor}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 flex-shrink-0" />
          <span>{course.schedule}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-border">
        <Button
          asChild
          size="sm"
          className="h-7 flex-1 gap-1.5 text-xs font-medium"
          style={{ backgroundColor: "#B0232A", color: "#fff" }}
        >
          <Link href={`/course/${course.id}?tab=syllabus`}>
            <FileText className="h-3 w-3" />
            강의계획서
          </Link>
        </Button>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="h-7 flex-1 gap-1.5 text-xs font-medium border-border hover:bg-accent"
          style={{ color: "#B0232A", borderColor: "#B0232A" } as React.CSSProperties}
        >
          <Link href={`/course/${course.id}?tab=professor`}>
            <UserCircle className="h-3 w-3" />
            교수 프로필
          </Link>
        </Button>
      </div>
    </div>
  )
}
