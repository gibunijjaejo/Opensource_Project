import { Course, CartItem, Token, User, HistoryItem } from "@/types"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

function getToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("access_token")
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
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
}

// ── Courses ───────────────────────────────────────────
export const coursesApi = {
  list: (params?: { q?: string; category?: string }) => {
    const qs = new URLSearchParams()
    if (params?.q) qs.set("q", params.q)
    if (params?.category) qs.set("category", params.category)
    const query = qs.toString() ? `?${qs}` : ""
    return request<Course[]>(`/api/v1/courses${query}`)
  },

  get: (courseId: number) =>
    request<Course>(`/api/v1/courses/${courseId}`),

  getByCode: (courseCode: string) =>
    request<Course>(`/api/v1/courses/code/${courseCode}`),
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
}
