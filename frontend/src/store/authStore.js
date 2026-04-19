import { create } from 'zustand'

export const useAuthStore = create((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,

  setAuth: (user, accessToken) =>
    set({ user, accessToken, isAuthenticated: true }),

  setAccessToken: (accessToken) =>
    set({ accessToken }),

  clearUser: () =>
    set({ user: null, accessToken: null, isAuthenticated: false }),

  // 앱 초기화 시 /auth/refresh 로 세션 복원
  initAuth: async () => {
    try {
      const { default: apiClient } = await import('../config/apiClient.js')
      const { data } = await apiClient.post('/auth/refresh')
      if (data.success) {
        set({ user: data.data.user, accessToken: data.data.accessToken, isAuthenticated: true })
      }
    } catch {
      set({ user: null, accessToken: null, isAuthenticated: false })
    }
  },
}))
