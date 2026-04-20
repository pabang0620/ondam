/**
 * 토스페이먼츠 빌링(정기결제) API 래퍼
 * 모든 함수는 throw 없이 { ok, data, errorCode, errorMessage } 형태로 반환
 */

const TOSS_API_BASE = 'https://api.tosspayments.com/v1'

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
 * authKey → billingKey 교환
 * POST /v1/billing/authorizations/issue
 * @param {{ authKey: string, customerKey: string }} params
 * @returns {Promise<{ ok: boolean, data, errorCode, errorMessage }>}
 */
export const issueBillingKey = async ({ authKey, customerKey }) => {
  const res = await fetch(`${TOSS_API_BASE}/billing/authorizations/issue`, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ authKey, customerKey }),
  })
  return normalizeResponse(res)
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
  const res = await fetch(`${TOSS_API_BASE}/billing/${encodeURIComponent(billingKey)}`, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ customerKey, amount, orderId, orderName, customerEmail }),
  })
  return normalizeResponse(res)
}

/**
 * 빌링키 삭제 (구독 해지 시 카드사 측 빌링키 해제)
 * DELETE /v1/billing/authorizations/{billingKey}
 * @param {{ billingKey: string }} params
 * @returns {Promise<{ ok: boolean, data, errorCode, errorMessage }>}
 */
export const deleteBillingKey = async ({ billingKey }) => {
  const res = await fetch(
    `${TOSS_API_BASE}/billing/authorizations/${encodeURIComponent(billingKey)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: getAuthHeader(),
        'Content-Type': 'application/json',
      },
    }
  )
  return normalizeResponse(res)
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

  const res = await fetch(
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
  return normalizeResponse(res)
}
