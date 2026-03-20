import axios from 'axios'

// All requests go to /api/* which Vite proxies to localhost:8000
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' })
// Add this alongside the existing getMe
export const getMeWithToken = (token) => 
  api.get('/auth/me', { headers: { Authorization: `Bearer ${token}` } })
// Attach JWT token to every request automatically
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

// Auto-logout on 401
api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Auth ──────────────────────────────────────────────────────────────────────
export const register  = (data) => api.post('/auth/register', data)
export const login     = (data) => api.post('/auth/login', data)
export const getMe     = ()     => api.get('/auth/me')

// ── Profile ───────────────────────────────────────────────────────────────────
export const uploadPDF      = (file) => {
  const fd = new FormData()
  fd.append('file', file)
  return api.post('/profile/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
}
export const getProfile     = () => api.get('/profile/')
export const updateProfile  = (data) => api.patch('/profile/', data)
export const getAnalysis    = () => api.get('/profile/analysis')

// ── Chat ──────────────────────────────────────────────────────────────────────
export const sendMessage    = (message, session_id = null) => {
  const params = session_id ? `?session_id=${session_id}` : ''
  return api.post(`/chat/send${params}`, { message })
}
export const getSessions    = () => api.get('/chat/sessions')
export const getSession     = (id) => api.get(`/chat/session/${id}`)
export const endSession     = (id) => api.post(`/chat/session/${id}/end`)
export const rateMessage    = (id, score) => api.patch(`/chat/message/${id}/rate?score=${score}`)
export const getMemory      = () => api.get('/chat/memory')
export const clearMemory    = () => api.delete('/chat/memory')
export const getAllHistory   = () => api.get('/chat/history')

export default api
