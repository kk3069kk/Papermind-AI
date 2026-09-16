import axios, { AxiosError } from 'axios'
import { useAuthStore } from '@/lib/store'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const apiClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

apiClient.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth
export const authApi = {
  register: (data: { email: string; username: string; password: string }) =>
    apiClient.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    apiClient.post('/auth/login', data),
  me: () => apiClient.get('/auth/me'),
}

// Papers
export const papersApi = {
  upload: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return apiClient.post('/papers/upload', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  list: (params?: { skip?: number; limit?: number; author?: string; year?: number }) =>
    apiClient.get('/papers', { params }),
  get: (id: number) => apiClient.get(`/papers/${id}`),
  delete: (id: number) => apiClient.delete(`/papers/${id}`),
  dashboard: () => apiClient.get('/papers/dashboard'),
}

// Chat
export const chatApi = {
  createSession: (data: { paper_ids?: number[]; title?: string }) =>
    apiClient.post('/chat/sessions', data),
  listSessions: () => apiClient.get('/chat/sessions'),
  getSession: (id: string) => apiClient.get(`/chat/sessions/${id}`),
  deleteSession: (id: string) => apiClient.delete(`/chat/sessions/${id}`),
  ask: (data: { session_id: string; question: string; top_k?: number }) =>
    apiClient.post('/chat/ask', data),
}

// RAG
export const ragApi = {
  ask: (data: { question: string; paper_ids?: number[]; top_k?: number }) =>
    apiClient.post('/rag/ask', data),
  summarize: (paper_id: number) =>
    apiClient.post('/rag/summarize', { paper_id }),
  compare: (paper_id_1: number, paper_id_2: number) =>
    apiClient.post('/rag/compare', { paper_id_1, paper_id_2 }),
  search: (data: { query: string; author?: string; year?: number; top_k?: number }) =>
    apiClient.post('/rag/search', data),
  recommend: (paper_id: number, top_k?: number) =>
    apiClient.post('/rag/recommend', { paper_id, top_k }),
}
