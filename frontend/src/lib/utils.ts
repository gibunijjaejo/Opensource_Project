import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getCurrentSemester(): { year: number; semester: number; label: string } {
  const now = new Date()
  const month = now.getMonth() + 1 // 1~12
  const year = now.getFullYear()
  const semester = month >= 2 && month <= 7 ? 1 : 2
  return { year, semester, label: `${year}년 ${semester}학기` }
}
