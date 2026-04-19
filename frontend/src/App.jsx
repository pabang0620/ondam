import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useAuthStore } from './store/authStore.js'

import MainLayout from './layouts/MainLayout.jsx'
import AuthLayout from './layouts/AuthLayout.jsx'
import AdminLayout from './layouts/AdminLayout.jsx'

import { ROUTES } from './constants/routes.js'

// 구현된 페이지
import HomePage from './pages/home/HomePage.jsx'
import LoginPage from './pages/auth/LoginPage.jsx'
import JoinPage from './pages/auth/JoinPage.jsx'

// Lazy 로드 페이지
const PhotoPage = lazy(() => import('./pages/photo/PhotoPage.jsx'))
const PhotoOrderPage = lazy(() => import('./pages/photo/PhotoOrderPage.jsx'))
const PhotoPaymentPage = lazy(() => import('./pages/photo/PhotoPaymentPage.jsx'))
const PhotoProcessingPage = lazy(() => import('./pages/photo/PhotoProcessingPage.jsx'))
const PhotoResultPage = lazy(() => import('./pages/photo/PhotoResultPage.jsx'))
const WillPage = lazy(() => import('./pages/will/WillPage.jsx'))
const WillConsentPage = lazy(() => import('./pages/will/WillConsentPage.jsx'))
const WillBeneficiariesPage = lazy(() => import('./pages/will/WillBeneficiariesPage.jsx'))
const WillRecordPage = lazy(() => import('./pages/will/WillRecordPage.jsx'))
const WillPhotoPage = lazy(() => import('./pages/will/WillPhotoPage.jsx'))
const WillPreviewPage = lazy(() => import('./pages/will/WillPreviewPage.jsx'))
const WillPaymentPage = lazy(() => import('./pages/will/WillPaymentPage.jsx'))
const WillProcessingPage = lazy(() => import('./pages/will/WillProcessingPage.jsx'))
const WillVaultPage = lazy(() => import('./pages/will/WillVaultPage.jsx'))
const WillEventPage = lazy(() => import('./pages/will/WillEventPage.jsx'))
const WillReleasePage = lazy(() => import('./pages/will/WillReleasePage.jsx'))
const WillWatchPage = lazy(() => import('./pages/will/WillWatchPage.jsx'))
const PetPage = lazy(() => import('./pages/pet/PetPage.jsx'))
const PetNewPage = lazy(() => import('./pages/pet/PetNewPage.jsx'))
const PetDetailPage = lazy(() => import('./pages/pet/PetDetailPage.jsx'))
const PetPortraitPage = lazy(() => import('./pages/pet/PetPortraitPage.jsx'))
const PetSubscriptionPage = lazy(() => import('./pages/pet/PetSubscriptionPage.jsx'))
const MemorialPage = lazy(() => import('./pages/memorial/MemorialPage.jsx'))
const MyPage = lazy(() => import('./pages/mypage/MyPage.jsx'))
const KakaoCallbackPage = lazy(() => import('./pages/auth/KakaoCallbackPage.jsx'))
const AdminLoginPage = lazy(() => import('./pages/admin/AdminLoginPage.jsx'))
const AdminPage = lazy(() => import('./pages/admin/AdminPage.jsx'))
const AdminReleasePage = lazy(() => import('./pages/admin/AdminReleasePage.jsx'))
const AdminOrdersPage = lazy(() => import('./pages/admin/AdminOrdersPage.jsx'))
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage.jsx'))

// Placeholder — 아직 구현되지 않은 페이지
const Placeholder = ({ title }) => (
  <div
    className="flex flex-col items-center justify-center min-h-[60vh] gap-4"
    style={{ color: 'var(--color-text-secondary)' }}
  >
    <p style={{ fontSize: 'var(--font-size-xl)', fontWeight: 600 }}>{title}</p>
    <p style={{ fontSize: 'var(--font-size-base)' }}>준비 중입니다</p>
  </div>
)

function PageFallback() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div
        className="w-10 h-10 rounded-full border-4 border-t-transparent animate-spin"
        style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
        role="status"
        aria-label="페이지 불러오는 중"
      />
    </div>
  )
}

export default function App() {
  useEffect(() => {
    useAuthStore.getState().initAuth()
  }, [])

  return (
    <BrowserRouter>
      <Suspense fallback={<PageFallback />}>
        <Routes>
          {/* 메인 레이아웃 */}
          <Route element={<MainLayout />}>
            <Route index path={ROUTES.HOME} element={<HomePage />} />
            <Route path={ROUTES.PHOTO} element={<PhotoPage />} />
            <Route path={ROUTES.PHOTO_ORDER} element={<PhotoOrderPage />} />
            <Route path={ROUTES.PHOTO_PAYMENT} element={<PhotoPaymentPage />} />
            <Route path={ROUTES.PHOTO_PROCESSING} element={<PhotoProcessingPage />} />
            <Route path={ROUTES.PHOTO_RESULT} element={<PhotoResultPage />} />

            <Route path={ROUTES.WILL} element={<WillPage />} />
            <Route path={ROUTES.WILL_CONSENT} element={<WillConsentPage />} />
            <Route path={ROUTES.WILL_BENEFICIARIES} element={<WillBeneficiariesPage />} />
            <Route path={ROUTES.WILL_RECORD} element={<WillRecordPage />} />
            <Route path={ROUTES.WILL_PHOTO} element={<WillPhotoPage />} />
            <Route path={ROUTES.WILL_PREVIEW} element={<WillPreviewPage />} />
            <Route path={ROUTES.WILL_PAYMENT} element={<WillPaymentPage />} />
            <Route path={ROUTES.WILL_PROCESSING} element={<WillProcessingPage />} />
            <Route path={ROUTES.WILL_VAULT} element={<WillVaultPage />} />
            <Route path={ROUTES.WILL_EVENT} element={<WillEventPage />} />
            <Route path={ROUTES.WILL_RELEASE} element={<WillReleasePage />} />
            <Route path={ROUTES.WILL_WATCH} element={<WillWatchPage />} />

            <Route path={ROUTES.PET} element={<PetPage />} />
            <Route path={ROUTES.PET_SUBSCRIPTION} element={<PetSubscriptionPage />} />
            <Route path={ROUTES.PET_NEW} element={<PetNewPage />} />
            <Route path={ROUTES.PET_DETAIL} element={<PetDetailPage />} />
            <Route path={ROUTES.PET_PORTRAIT} element={<PetPortraitPage />} />

            <Route path={ROUTES.MEMORIAL} element={<MemorialPage />} />
            <Route path={ROUTES.MY} element={<MyPage />} />
          </Route>

          {/* 인증 레이아웃 */}
          <Route element={<AuthLayout />}>
            <Route path={ROUTES.LOGIN} element={<LoginPage />} />
            <Route path={ROUTES.JOIN} element={<JoinPage />} />
          </Route>

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
              </div>
            }
          />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
