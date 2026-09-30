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
  // 매 렌더마다 새로 만들어지는 콜백을 소켓 재연결 없이 최신 값으로 호출한다
  const onProgressRef = useRef(onProgress)

  useEffect(() => {
    onProgressRef.current = onProgress
  }, [onProgress])

  useEffect(() => {
    if (!accessToken) return

    let socket
    // FE-PP-6: 동적 import가 끝나기 전에 cleanup이 먼저 돌면(StrictMode 이중 마운트,
    // 빠른 화면 이동) socket이 아직 없어 disconnect되지 않고, 뒤늦게 연결된 소켓이
    // 남는다. cancelled 플래그로 늦게 도착한 import 결과를 버린다.
    let cancelled = false

    import('socket.io-client')
      .then(({ io }) => {
        if (cancelled) return
        socket = io(import.meta.env.VITE_API_URL || '', {
          auth: { token: accessToken },
          transports: ['websocket'],
        })
        socketRef.current = socket

        socket.on('connect', () => setIsConnected(true))
        socket.on('disconnect', () => setIsConnected(false))
        socket.on('job:progress', (data) => onProgressRef.current?.(data))
      })
      .catch(() => {
        // socket.io-client 로드 실패 시 무시 (폴링으로 폴백)
      })

    return () => {
      cancelled = true
      socket?.disconnect()
      socketRef.current = null
      setIsConnected(false)
    }
  }, [accessToken])

  return { isConnected }
}
