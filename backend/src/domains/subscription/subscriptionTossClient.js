/**
 * 토스페이먼츠 빌링(정기결제) API 래퍼
 * 모든 함수는 throw 없이 { ok, data, errorCode, errorMessage } 형태로 반환
 */

const TOSS_API_BASE = 'https://api.tosspayments.com/v1'

// [CRITICAL #1] 토스 API 호출에 반드시 부여하는 타임아웃(ms). 이전에는 executeBilling을
// 포함한 모든 호출에 타임아웃도 예외 처리도 없어, 네트워크 단절로 응답만 유실돼도
// (카드는 이미 승인됐을 수 있음) 그대로 uncaught rejection으로 job이 실패했다.
//
// [LOW#3] 10초는 카드 승인(발급사 통신 포함) 호출로는 짧다 - 발급사 응답 지연으로
// 정상 승인 건이 타임아웃 처리되는 빈도가 낮지 않고, 그게 곧 이 파일 상단에서
// 설명하는 "응답 유실" 문제의 실제 발생 빈도다. 30초로 늘리고 환경변수로 조정
// 가능하게 한다. Number()가 NaN을 돌려주는 경우(미설정/공백/숫자 아님)를
// Number.isFinite로 방어한다 - NaN이 그대로 쓰이면 AbortSignal.timeout(NaN)이
// 즉시 타임아웃되어 모든 호출이 실패한다.
const TOSS_BILLING_TIMEOUT_MS = (() => {
  const raw = Number(process.env.TOSS_BILLING_TIMEOUT_MS)
  return Number.isFinite(raw) && raw > 0 ? raw : 30_000
})()

/**
 * Basic 인증 헤더 생성
 * @returns {string}
 */
const getAuthHeader = () => {
  const secretKey = process.env.TOSS_SECRET_KEY
  if (!secretKey) {
    throw Object.assign(new Error('TOSS_SECRET_KEY 환경변수가 설정되지 않았습니다'), { status: 500 })
  }
  return `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`
}

/**
 * 공통 응답 정규화
 * @param {Response} res
 * @returns {Promise<{ ok: boolean, data: object|null, errorCode: string|null, errorMessage: string|null }>}
 */
const normalizeResponse = async (res) => {
  let body
  try {
    body = await res.json()
  } catch {
    body = null
  }

  if (res.ok) {
    return { ok: true, data: body, errorCode: null, errorMessage: null }
  }
  return {
    ok: false,
    data: null,
    errorCode: body?.code ?? 'UNKNOWN',
    errorMessage: body?.message ?? '토스페이먼츠 API 오류',
  }
}

/**
 * [CRITICAL #1 수정] fetch + 타임아웃 + 예외 처리를 한 곳에서 담당한다. 이 모듈의
 * 모든 함수는 "throw 없이 { ok, data, errorCode, errorMessage } 형태로 반환"하는
 * 계약을 문서 상단에 명시하고 있었는데, 실제로는 네트워크 예외/타임아웃이 그대로
 * throw되어 계약을 어기고 있었다. 여기서 잡아 계약대로 정규화한다.
 * @param {string} url
 * @param {RequestInit} options
 * @returns {Promise<{ ok: boolean, data: object|null, errorCode: string|null, errorMessage: string|null }>}
 */
const fetchToss = async (url, options) => {
  try {
    const res = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(TOSS_BILLING_TIMEOUT_MS),
    })
    return await normalizeResponse(res)
  } catch (err) {
    const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError'
    console.error('[subscriptionTossClient] 토스 API 호출 실패:', {
      url,
      timeout: isTimeout,
      error: err.message,
    })
    return {
      ok: false,
      data: null,
      errorCode: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
      errorMessage: isTimeout ? '토스 API 응답 시간 초과' : (err.message ?? '네트워크 오류'),
    }
  }
}

/**
 * authKey → billingKey 교환
 * POST /v1/billing/authorizations/issue
 * @param {{ authKey: string, customerKey: string }} params
 * @returns {Promise<{ ok: boolean, data, errorCode, errorMessage }>}
 */
export const issueBillingKey = async ({ authKey, customerKey }) => {
  return fetchToss(`${TOSS_API_BASE}/billing/authorizations/issue`, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ authKey, customerKey }),
  })
}

/**
 * 자동결제 실행 (빌링키 결제)
 * POST /v1/billing/{billingKey}
 * @param {{ billingKey: string, customerKey: string, amount: number, orderId: string, orderName: string, customerEmail: string }} params
 * @returns {Promise<{ ok: boolean, data, errorCode, errorMessage }>}
 */
export const executeBilling = async ({
  billingKey,
  customerKey,
  amount,
  orderId,
  orderName,
  customerEmail,
}) => {
  return fetchToss(`${TOSS_API_BASE}/billing/${encodeURIComponent(billingKey)}`, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ customerKey, amount, orderId, orderName, customerEmail }),
  })
}

/**
 * 주문번호로 결제 상태 조회 (재선점/이중청구 방지용)
 * GET /v1/payments/orders/{orderId}
 * [CRITICAL #1] executeBilling 응답이 유실된 뒤(예: 서버 크래시) 같은 orderId로
 * 재시도하기 전에, 실제로 결제가 이미 이뤄졌는지 확인하는 용도로 쓴다.
 * @param {{ orderId: string }} params
 * @returns {Promise<{ ok: boolean, data, errorCode, errorMessage }>}
 */
export const getPaymentByOrderId = async ({ orderId }) => {
  return fetchToss(`${TOSS_API_BASE}/payments/orders/${encodeURIComponent(orderId)}`, {
    method: 'GET',
    headers: {
      Authorization: getAuthHeader(),
    },
  })
}

/**
 * 빌링키 삭제 (구독 해지 시 카드사 측 빌링키 해제)
 * DELETE /v1/billing/authorizations/{billingKey}
 * @param {{ billingKey: string }} params
 * @returns {Promise<{ ok: boolean, data, errorCode, errorMessage }>}
 */
export const deleteBillingKey = async ({ billingKey }) => {
  return fetchToss(
    `${TOSS_API_BASE}/billing/authorizations/${encodeURIComponent(billingKey)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'application/json',
      },
    }
  )
}

/**
 * 결제 취소 (환불)
 * POST /v1/payments/{paymentKey}/cancel
 * @param {{ paymentKey: string, cancelReason: string, cancelAmount?: number }} params
 * @returns {Promise<{ ok: boolean, data, errorCode, errorMessage }>}
 */
export const cancelPayment = async ({ paymentKey, cancelReason, cancelAmount }) => {
  const body = { cancelReason }
  if (cancelAmount !== undefined) {
    body.cancelAmount = cancelAmount
  }

  return fetchToss(
    `${TOSS_API_BASE}/payments/${encodeURIComponent(paymentKey)}/cancel`,
    {
      method: 'POST',
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )
}
