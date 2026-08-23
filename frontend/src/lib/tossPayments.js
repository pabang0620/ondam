// 결함2 수정: VITE_TOSS_CLIENT_KEY가 비어 있으면(.env 미설정) window.TossPayments(undefined)가
// 내부적으로 undefined.startsWith(...)를 호출하며 동기 throw한다. 이 throw가
// script.onload 콜백(비동기 이벤트 핸들러) 안에서 발생하면 Promise 실행자(executor) 밖이라
// resolve/reject 어느 쪽도 호출되지 않은 채 "Uncaught TypeError"만 콘솔에 찍히고 Promise가
// 영구 pending 상태로 남는다 - 결제 버튼 4종(사진관/영상편지/선물하기/구독)이 전부
// "결제 처리 중..."에서 멈추는 근본 원인이었다.
//
// FIX: ep-006과 유사한 원칙 - 실패할 수 있는 모든 경로(script.onload 내부 throw,
// script.onerror, 스크립트가 아예 응답하지 않는 경우)를 명시적으로 reject한다.
// 또한 reject된 Promise를 그대로 캐시해두면 같은 탭에서 재시도 버튼을 다시 눌러도
// 캐시된 실패 Promise가 즉시 재거부되어 재시도가 막힌다 - getTossPayments() 호출부에서
// 실패 시 캐시를 비워 다음 호출이 처음부터 다시 시도하게 한다.
const TOSS_SDK_URL = 'https://js.tosspayments.com/v1/payment'
const LOAD_TIMEOUT_MS = 15000

let tossPromise = null

function loadTossPaymentsInstance() {
  const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY

  return new Promise((resolve, reject) => {
    // 어르신 사용자에게는 환경변수 이름을 노출하지 않는다 - 원인은 콘솔에만 남긴다.
    if (!clientKey) {
      console.error('[tossPayments] VITE_TOSS_CLIENT_KEY 환경변수가 설정되지 않았습니다')
      reject(new Error('지금은 결제를 진행할 수 없습니다. 잠시 후 다시 시도해 주시거나 고객센터로 문의해 주세요.'))
      return
    }

    const initInstance = () => {
      try {
        resolve(window.TossPayments(clientKey))
      } catch (err) {
        console.error('[tossPayments] TossPayments 초기화 실패:', err)
        reject(new Error('결제 준비 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.'))
      }
    }

    if (window.TossPayments) {
      initInstance()
      return
    }

    const script = document.createElement('script')
    script.src = TOSS_SDK_URL

    // 네트워크 차단(광고 차단 확장 등)으로 onload/onerror 둘 다 끝내 호출되지 않는
    // 드문 경우까지 대비한 안전망 - 이게 없으면 그 경로에서도 영구 pending이 된다.
    const timeoutId = window.setTimeout(() => {
      console.error('[tossPayments] SDK 로드 타임아웃')
      reject(new Error('결제 모듈을 불러오지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.'))
    }, LOAD_TIMEOUT_MS)

    script.onload = () => {
      window.clearTimeout(timeoutId)
      if (!window.TossPayments) {
        console.error('[tossPayments] 스크립트는 로드됐으나 window.TossPayments가 없음')
        reject(new Error('결제 모듈 초기화에 실패했습니다. 잠시 후 다시 시도해 주세요.'))
        return
      }
      // FIX 결함2: initInstance 내부 try/catch가 여기서 발생하는 동기 throw까지
      // 반드시 reject로 변환한다 - onload는 executor 밖에서 실행되므로 여기서
      // 잡지 않으면 Promise가 영원히 미해결로 남는다.
      initInstance()
    }
    script.onerror = () => {
      window.clearTimeout(timeoutId)
      console.error('[tossPayments] SDK 스크립트 로드 실패')
      reject(new Error('결제 모듈을 불러오지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.'))
    }

    document.head.appendChild(script)
  })
}

export function getTossPayments() {
  if (tossPromise) return tossPromise

  tossPromise = loadTossPaymentsInstance().catch((err) => {
    // 실패한 Promise를 그대로 캐시해두면 재시도 버튼을 다시 눌러도 같은 거부만
    // 반복된다 - 캐시를 비워 다음 호출이 스크립트 로드부터 다시 시도하게 한다.
    tossPromise = null
    throw err
  })

  return tossPromise
}
