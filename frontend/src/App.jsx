import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import { useAuthStore } from './store/authStore.js'
import BrandLoader from './components/common/BrandLoader.jsx'

import MainLayout from './layouts/MainLayout.jsx'
import AuthLayout from './layouts/AuthLayout.jsx'
import AdminLayout from './layouts/AdminLayout.jsx'
import PrivateRoute from './layouts/PrivateRoute.jsx'

import { ROUTES } from './constants/routes.js'

// 구현된 페이지
import HomePage from './pages/home/HomePage.jsx'
import LoginPage from './pages/auth/LoginPage.jsx'
import JoinPage from './pages/auth/JoinPage.jsx'

// Lazy 로드 페이지
const PhotoPage = lazy(() => import('./pages/photo/PhotoPage.jsx'))
const PhotoOrderPage = lazy(() => import('./pages/photo/PhotoOrderPage.jsx'))
const PhotoPaymentPage = lazy(() => import('./pages/photo/PhotoPaymentPage.jsx'))
const PhotoPaymentSuccessPage = lazy(() => import('./pages/photo/PhotoPaymentSuccessPage.jsx'))
const PhotoPaymentFailPage = lazy(() => import('./pages/photo/PhotoPaymentFailPage.jsx'))
const PhotoProcessingPage = lazy(() => import('./pages/photo/PhotoProcessingPage.jsx'))
const PhotoResultPage = lazy(() => import('./pages/photo/PhotoResultPage.jsx'))
const WillPage = lazy(() => import('./pages/will/WillPage.jsx'))
const WillConsentPage = lazy(() => import('./pages/will/WillConsentPage.jsx'))
const WillBeneficiariesPage = lazy(() => import('./pages/will/WillBeneficiariesPage.jsx'))
const WillRecordPage = lazy(() => import('./pages/will/WillRecordPage.jsx'))
const WillPhotoPage = lazy(() => import('./pages/will/WillPhotoPage.jsx'))
const WillPreviewPage = lazy(() => import('./pages/will/WillPreviewPage.jsx'))
const WillPaymentPage = lazy(() => import('./pages/will/WillPaymentPage.jsx'))
const WillPaymentSuccessPage = lazy(() => import('./pages/will/WillPaymentSuccessPage.jsx'))
const WillPaymentFailPage = lazy(() => import('./pages/will/WillPaymentFailPage.jsx'))
const WillProcessingPage = lazy(() => import('./pages/will/WillProcessingPage.jsx'))
const WillVaultPage = lazy(() => import('./pages/will/WillVaultPage.jsx'))
// 2026-08-22 판매 보류 결정(결정2)으로 WillEventPage 라우트 제외. 되살리려면
// 아래 lazy import 복구 + 라우트 등록 복구 + WillVaultPage.jsx 진입 버튼 복구.
// const WillEventPage = lazy(() => import('./pages/will/WillEventPage.jsx'))
const WillReleasePage = lazy(() => import('./pages/will/WillReleasePage.jsx'))
const WillWatchPage = lazy(() => import('./pages/will/WillWatchPage.jsx'))
const PetPage = lazy(() => import('./pages/pet/PetPage.jsx'))
const PetNewPage = lazy(() => import('./pages/pet/PetNewPage.jsx'))
const PetDetailPage = lazy(() => import('./pages/pet/PetDetailPage.jsx'))
const PetPortraitPage = lazy(() => import('./pages/pet/PetPortraitPage.jsx'))
const PetSubscriptionPage = lazy(() => import('./pages/pet/PetSubscriptionPage.jsx'))
const BillingAuthSuccessPage = lazy(() => import('./pages/pet/BillingAuthSuccessPage.jsx'))
const BillingAuthFailPage = lazy(() => import('./pages/pet/BillingAuthFailPage.jsx'))
const MemorialPage = lazy(() => import('./pages/memorial/MemorialPage.jsx'))
const MyPage = lazy(() => import('./pages/mypage/MyPage.jsx'))
const KakaoCallbackPage = lazy(() => import('./pages/auth/KakaoCallbackPage.jsx'))
const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage.jsx'))
const AdminPage = lazy(() => import('./pages/admin/AdminPage.jsx'))
const AdminReleasePage = lazy(() => import('./pages/admin/AdminReleasePage.jsx'))
const AdminOrdersPage = lazy(() => import('./pages/admin/AdminOrdersPage.jsx'))
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage.jsx'))
const AdminAdSpendPage = lazy(() => import('./pages/admin/AdminAdSpendPage.jsx'))

const GiftNewPage = lazy(() => import('./pages/gift/GiftNewPage.jsx'))
const GiftPaymentPage = lazy(() => import('./pages/gift/GiftPaymentPage.jsx'))
const GiftPaymentSuccessPage = lazy(() => import('./pages/gift/GiftPaymentSuccessPage.jsx'))
const GiftPaymentFailPage = lazy(() => import('./pages/gift/GiftPaymentFailPage.jsx'))
const GiftMinePage = lazy(() => import('./pages/gift/GiftMinePage.jsx'))
const GiftPerformPage = lazy(() => import('./pages/gift/GiftPerformPage.jsx'))
const GiftPerformPhotoPage = lazy(() => import('./pages/gift/GiftPerformPhotoPage.jsx'))
const GiftPerformWillPage = lazy(() => import('./pages/gift/GiftPerformWillPage.jsx'))

// Placeholder - 아직 구현되지 않은 페이지
const Placeholder = ({ title }) => (
  <div
    className="flex flex-col items-center justify-center min-h-[60vh] gap-4"
    style={{ color: 'var(--color-text-secondary)' }}
  >
    <p style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600 }}>{title}</p>
    <p style={{ fontSize: 'var(--font-size-base)' }}>준비 중입니다</p>
  </div>
)

export default function App() {
  useEffect(() => {
    useAuthStore.getState().initAuth()
  }, [])

  return (
    <BrowserRouter>
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-[60vh]">
            <BrandLoader />
          </div>
        }
      >
        <Routes>
          {/* 공개 메인 레이아웃 - 인증 불필요 */}
          <Route element={<MainLayout />}>
            <Route index path={ROUTES.HOME} element={<HomePage />} />
            <Route path={ROUTES.MEMORIAL} element={<MemorialPage />} />
            <Route path={ROUTES.WILL_RELEASE} element={<WillReleasePage />} />
            <Route path={ROUTES.WILL_WATCH} element={<WillWatchPage />} />
            {/* 선물 수행 링크 - 무계정 진입(SPEC-01 3-2), 본인확인/계정연결은 페이지 내부에서 처리 */}
            <Route path={ROUTES.GIFT_PERFORM} element={<GiftPerformPage />} />
          </Route>

          {/* 보호된 메인 레이아웃 - 인증 필요 */}
          <Route element={<PrivateRoute><MainLayout /></PrivateRoute>}>
            <Route path={ROUTES.PHOTO} element={<PhotoPage />} />
            <Route path={ROUTES.PHOTO_ORDER} element={<PhotoOrderPage />} />
            <Route path={ROUTES.PHOTO_PAYMENT} element={<PhotoPaymentPage />} />
            <Route path={ROUTES.PHOTO_PAYMENT_SUCCESS} element={<PhotoPaymentSuccessPage />} />
            <Route path={ROUTES.PHOTO_PAYMENT_FAIL} element={<PhotoPaymentFailPage />} />
            <Route path={ROUTES.PHOTO_PROCESSING} element={<PhotoProcessingPage />} />
            <Route path={ROUTES.PHOTO_RESULT} element={<PhotoResultPage />} />

            <Route path={ROUTES.WILL} element={<WillPage />} />
            <Route path={ROUTES.WILL_CONSENT} element={<WillConsentPage />} />
            <Route path={ROUTES.WILL_BENEFICIARIES} element={<WillBeneficiariesPage />} />
            <Route path={ROUTES.WILL_RECORD} element={<WillRecordPage />} />
            <Route path={ROUTES.WILL_PHOTO} element={<WillPhotoPage />} />
            <Route path={ROUTES.WILL_PREVIEW} element={<WillPreviewPage />} />
            <Route path={ROUTES.WILL_PAYMENT} element={<WillPaymentPage />} />
            <Route path={ROUTES.WILL_PAYMENT_SUCCESS} element={<WillPaymentSuccessPage />} />
            <Route path={ROUTES.WILL_PAYMENT_FAIL} element={<WillPaymentFailPage />} />
            <Route path={ROUTES.WILL_PROCESSING} element={<WillProcessingPage />} />
            <Route path={ROUTES.WILL_VAULT} element={<WillVaultPage />} />
            {/* 2026-08-22 판매 보류 결정(결정2)으로 이벤트 영상 라우트 제외.
                되살리려면 위 lazy import 복구 후 이 줄의 주석을 해제한다. */}
            {/* <Route path={ROUTES.WILL_EVENT} element={<WillEventPage />} /> */}

            <Route path={ROUTES.PET} element={<PetPage />} />
            <Route path={ROUTES.PET_SUBSCRIPTION} element={<PetSubscriptionPage />} />
            <Route path={ROUTES.PET_BILLING_SUCCESS} element={<BillingAuthSuccessPage />} />
            <Route path={ROUTES.PET_BILLING_FAIL} element={<BillingAuthFailPage />} />
            <Route path={ROUTES.PET_NEW} element={<PetNewPage />} />
            <Route path={ROUTES.PET_DETAIL} element={<PetDetailPage />} />
            <Route path={ROUTES.PET_PORTRAIT} element={<PetPortraitPage />} />

            <Route path={ROUTES.MY} element={<MyPage />} />

            {/* 선물하기 (SPEC-01 DEV-10) - 구매(자녀)는 인증 필요 */}
            <Route path={ROUTES.GIFT_NEW} element={<GiftNewPage />} />
            <Route path={ROUTES.GIFT_PAYMENT} element={<GiftPaymentPage />} />
            <Route path={ROUTES.GIFT_PAYMENT_SUCCESS} element={<GiftPaymentSuccessPage />} />
            <Route path={ROUTES.GIFT_PAYMENT_FAIL} element={<GiftPaymentFailPage />} />
            <Route path={ROUTES.GIFT_MINE} element={<GiftMinePage />} />
            {/* 수행 콘텐츠 제작 단계 - 계정 연결(linkAccount) 이후에만 도달하므로 인증 필요 */}
            <Route path={ROUTES.GIFT_PERFORM_PHOTO} element={<GiftPerformPhotoPage />} />
            <Route path={ROUTES.GIFT_PERFORM_WILL} element={<GiftPerformWillPage />} />
          </Route>

          {/* 인증 레이아웃 */}
          <Route element={<AuthLayout />}>
            <Route path={ROUTES.LOGIN} element={<LoginPage />} />
            <Route path={ROUTES.JOIN} element={<JoinPage />} />
          </Route>

          {/* /mypage → /my 영구 redirect */}
          <Route path="/mypage" element={<Navigate to={ROUTES.MY} replace />} />

          {/* 카카오 콜백 (레이아웃 없음) */}
          <Route path="/auth/kakao/callback" element={<KakaoCallbackPage />} />

          {/* 관리자 로그인 (레이아웃 없음) */}
          <Route path={ROUTES.ADMIN_LOGIN} element={<AdminLoginPage />} />

          {/* 관리자 레이아웃 */}
          <Route element={<AdminLayout />}>
            <Route path={ROUTES.ADMIN} element={<AdminPage />} />
            <Route path={ROUTES.ADMIN_RELEASE} element={<AdminReleasePage />} />
            <Route path={ROUTES.ADMIN_ORDERS} element={<AdminOrdersPage />} />
            <Route path={ROUTES.ADMIN_USERS} element={<AdminUsersPage />} />
            <Route path={ROUTES.ADMIN_AD_SPEND} element={<AdminAdSpendPage />} />
          </Route>

          {/* 404 */}
          <Route
            path="*"
            element={
              <div
                className="flex flex-col items-center justify-center min-h-screen gap-4"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <p style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700 }}>404</p>
                <p style={{ fontSize: 'var(--font-size-lg)' }}>페이지를 찾을 수 없습니다</p>
                {/* FIX: 404에서 빠져나갈 조작 요소가 없었다 - 홈으로 가는 버튼(56px) */}
                <Link
                  to={ROUTES.HOME}
                  className="flex items-center justify-center font-semibold"
                  style={{
                    minHeight: 'var(--size-button-h)',
                    padding: '0 32px',
                    marginTop: 'var(--spacing-md)',
                    fontSize: 'var(--fs-button)',
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-text-on-dark)',
                    borderRadius: 'var(--radius-pill)',
                  }}
                >
                  홈으로 가기
                </Link>
              </div>
            }
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
