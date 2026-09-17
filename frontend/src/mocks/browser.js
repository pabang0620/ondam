// [DESIGN-PREVIEW] MSW 브라우저 워커 - 로컬 디자인 검토 전용, 프로덕션 빌드에는 포함되지 않음
import { setupWorker } from 'msw/browser'
import { handlers } from './handlers/index.js'

export const worker = setupWorker(...handlers)
