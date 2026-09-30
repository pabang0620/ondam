import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// FIX: public/mockServiceWorker.js(MSW 개발용)가 프로덕션 dist에 그대로 복사되지
// 않도록 빌드 직후 삭제한다. dev 서버에서는 public/에서 그대로 서빙된다.
function excludeMockServiceWorker() {
  let outDir = 'dist'
  return {
    name: 'exclude-mock-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    async closeBundle() {
      await rm(resolve(outDir, 'mockServiceWorker.js'), { force: true })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    excludeMockServiceWorker(),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      // FIX: 결함6 - useJobSocket.js는 VITE_API_URL 미설정 시 같은 origin(5173)의
      // 기본 경로(/socket.io)로 접속을 시도한다(backend/src/server.js의 SocketIO가
      // path 옵션 없이 기본값을 쓰고 있음을 확인). 이 프록시가 없으면 dev 환경에서
      // WebSocket 연결이 항상 실패하고 폴링으로 폴백해 실시간 진행률이 늦게 반영된다.
      // ws: true가 있어야 HTTP 업그레이드(WebSocket) 요청도 함께 프록시된다.
      '/socket.io': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
