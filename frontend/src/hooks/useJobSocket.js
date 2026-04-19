import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../store/authStore.js'

/**
 * 백엔드 socket.io 이벤트 구독 커스텀 훅
 *
 * @param {object} options
 * @param {function} options.onProgress - job:progress 이벤트 수신 시 호출
 *   data: { jobId, jobType, status, progress, resultUrl }
 *
 * @returns {{ isConnected: boolean }}
 *
 * 의존 패키지: socket.io-client (package.json에 이미 설치됨)
 */
export const useJobSocket = ({ onProgress } = {}) => {
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef(null)
  const accessToken = useAuthStore((s) => s.accessToken)

  useEffect(() => {
    if (!accessToken) return

    let socket

    import('socket.io-client')
      .then(({ io }) => {
        socket = io(import.meta.env.VITE_API_URL || '', {
          auth: { token: accessToken },
          transports: ['websocket'],
        })
        socketRef.current = socket

        socket.on('connect', () => setIsConnected(true))
        socket.on('disconnect', () => setIsConnected(false))
        socket.on('job:progress', (data) => onProgress?.(data))
      })
      .catch(() => {
        // socket.io-client 로드 실패 시 무시 (폴링으로 폴백)
      })

    return () => {
      socket?.disconnect()
      socketRef.current = null
      setIsConnected(false)
    }
  }, [accessToken])

  return { isConnected }
}
