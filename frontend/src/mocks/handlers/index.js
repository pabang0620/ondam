// [DESIGN-PREVIEW] MSW 핸들러 자동 수집 - 로컬 디자인 검토 전용
const modules = import.meta.glob('./*.js', { eager: true })

export const handlers = Object.entries(modules)
  .filter(([path]) => !path.endsWith('/index.js'))
  .flatMap(([, mod]) => mod.handlers ?? [])
