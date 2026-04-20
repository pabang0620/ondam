let tossPromise = null

export function getTossPayments() {
  if (tossPromise) return tossPromise
  tossPromise = new Promise((resolve, reject) => {
    if (window.TossPayments) {
      resolve(window.TossPayments(import.meta.env.VITE_TOSS_CLIENT_KEY))
      return
    }
    const script = document.createElement('script')
    script.src = 'https://js.tosspayments.com/v1/payment'
    script.onload = () => {
      if (!window.TossPayments) {
        reject(new Error('토스페이먼츠 SDK 초기화 실패'))
        return
      }
      resolve(window.TossPayments(import.meta.env.VITE_TOSS_CLIENT_KEY))
    }
    script.onerror = () => {
      tossPromise = null  // 실패 시 캐시 초기화 → 재시도 가능
      reject(new Error('토스페이먼츠 SDK 로드 실패'))
    }
    document.head.appendChild(script)
  })
  return tossPromise
}
