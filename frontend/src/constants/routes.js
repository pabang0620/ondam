export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  JOIN: '/join',

  PHOTO: '/photo',
  PHOTO_ORDER: '/photo/order',
  PHOTO_PAYMENT: '/photo/payment',
  PHOTO_PAYMENT_SUCCESS: '/photo/payment/success',
  PHOTO_PAYMENT_FAIL: '/photo/payment/fail',
  PHOTO_PROCESSING: '/photo/processing/:orderId',
  PHOTO_RESULT: '/photo/result/:orderId',

  WILL: '/will',
  WILL_CONSENT: '/will/consent',
  WILL_BENEFICIARIES: '/will/beneficiaries',
  WILL_RECORD: '/will/record',
  WILL_PHOTO: '/will/photo',
  WILL_PREVIEW: '/will/preview',
  WILL_PAYMENT: '/will/payment',
  WILL_PAYMENT_SUCCESS: '/will/payment/success',
  WILL_PAYMENT_FAIL: '/will/payment/fail',
  WILL_PROCESSING: '/will/processing/:willId',
  WILL_VAULT: '/will/vault',
  // 2026-08-22 판매 보류 결정(결정2)으로 App.jsx에 이 라우트가 등록되어 있지
  // 않다. 상수 자체는 보존(되살릴 때 참조용). 실제 접근 경로 없음.
  WILL_EVENT: '/will/event',
  WILL_RELEASE: '/release/:token',
  WILL_WATCH: '/watch/:token',

  PET: '/pet',
  PET_NEW: '/pet/new',
  PET_DETAIL: '/pet/:petId',
  PET_PORTRAIT: '/pet/:petId/portrait',
  PET_SUBSCRIPTION: '/pet/subscription',
  PET_BILLING_SUCCESS: '/pet/billing/success',
  PET_BILLING_FAIL: '/pet/billing/fail',
  MEMORIAL: '/memorial/:slug',

  MY: '/my',

  ADMIN_LOGIN: '/admin/login',
  ADMIN: '/admin',
  ADMIN_RELEASE: '/admin/release',
  ADMIN_ORDERS: '/admin/orders',
  ADMIN_USERS: '/admin/users',
}
