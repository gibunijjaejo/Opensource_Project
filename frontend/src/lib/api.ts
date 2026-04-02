<<<<<<< HEAD
import { Course, CartItem, Token, User, HistoryItem, SyllabusSummary } from "../types"
=======
import { Course, CartItem, Token, User, HistoryItem } from "@/types"
>>>>>>> upstream/dev

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"

function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("access_token")
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  isMultipart = false
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }
  // multipart/form-data는 브라우저가 Content-Type + boundary를 자동으로 설정
  if (!isMultipart) {
    headers["Content-Type"] = "application/json"
  }
  if (token) headers["Authorization"] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("access_token")
      window.location.href = "/login"
    }
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || body.message || "요청에 실패했습니다.")
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

// ── Auth ──────────────────────────────────────────────
export const authApi = {
  sendEmail: (email: string) =>
    request<{ message: string }>("/auth/send-email", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  verifyCode: (email: string, code: string) =>
    request<{ message: string }>("/auth/verify-code", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    }),

  register: (data: {
    student_id: number
    name: string
    email: string
    password: string
    current_semester?: number
  }) =>
    request<User>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  login: (email: string, password: string) =>
    request<Token>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

<<<<<<< HEAD
  logout: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("access_token")
    }
  },
=======
  sendResetEmail: (email: string) =>
    request<{ message: string }>("/auth/reset-password/send-email", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (email: string, code: string, new_password: string) =>
    request<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ email, code, new_password }),
    }),
>>>>>>> upstream/dev
}

// ── Courses ───────────────────────────────────────────
export const coursesApi = {
  list: (params?: { q?: string; category?: string; year?: number; semester?: number }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set("q", params.q)
    if (params?.category) qs.set("category", params.category)
    if (params?.year) qs.set("year", String(params.year))
    if (params?.semester) qs.set("semester", String(params.semester))
    const query = qs.toString() ? `?${qs}` : ""
    return request<Course[]>(`/api/v1/courses${query}`)
  },

  get: (courseId: number) =>
    request<Course>(`/api/v1/courses/${courseId}`),
}

// ── Cart ──────────────────────────────────────────────
export const cartApi = {
  get: () => request<CartItem[]>("/api/v1/cart"),

  add: (course_id: number) =>
    request<CartItem>("/api/v1/cart", {
      method: "POST",
      body: JSON.stringify({ course_id }),
    }),

  remove: (cartId: number) =>
    request<void>(`/api/v1/cart/${cartId}`, { method: "DELETE" }),
}

// ── Users ─────────────────────────────────────────────
export const usersApi = {
  me: () => request<User>("/api/v1/users/me"),
}

// ── History ───────────────────────────────────────────
export const historyApi = {
  getMyHistories: () => request<HistoryItem[]>("/history/me"),

  add: (data: { course_code: string; year: number; semester: number; is_retake?: boolean }) =>
    request<HistoryItem>("/history", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (historyId: number, data: { year?: number; semester?: number; is_retake?: boolean }) =>
    request<HistoryItem>(`/history/${historyId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  remove: (historyId: number) =>
    request<void>(`/history/${historyId}`, { method: "DELETE" }),
}

// ── Syllabus ──────────────────────────────────────────
export const syllabusApi = {
  summarize: (file: File) => {
    const formData = new FormData()
    formData.append("file", file)
    return request<SyllabusSummary>("/api/v1/syllabus/summarize", {
      method: "POST",
      body: formData,
    }, true)
  },

  get: (courseId: number) =>
    request<SyllabusSummary>(`/api/v1/syllabus/${courseId}`),
}
