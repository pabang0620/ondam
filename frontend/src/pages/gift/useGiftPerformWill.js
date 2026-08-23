import { useState, useCallback, useRef, useEffect } from 'react'
import apiClient from '../../config/apiClient.js'
// will 도메인의 검증된 API 호출 함수를 그대로 재사용한다(재설계 없음) - 음성 클론·
// 유언장 생성·영상 활성화·상태폴링 로직은 willApi.js/willService.js와 동일하다.
import { willApi } from '../will/willApi.js'
import { uploadPhoto } from '../photo/photoApi.js'
import { attachWillOrder, completeGift } from './giftApi.js'
import { WILL_CONSENT_ITEMS } from '../../components/consent/consentItems.js'
import { useConsentChecklist } from '../../components/consent/useConsentChecklist.js'

export const STEP = {
  CONSENT: 'consent',
  PHOTO: 'photo',
  VOICE: 'voice',
  MESSAGE: 'message',
  BENEFICIARY: 'beneficiary',
  GENERATING: 'generating',
  DONE: 'done',
  ERROR: 'error',
}

// FIX: 무한 폴링 결함 (will/useWillProcessing.js와 동일한 유형) - 결제자(선물을
// 보내주신 분)와 이 화면을 보는 수행자(부모)가 다른 선물 경로 특성을 반영해
// "본인이 결제했다"는 문구 없이 안내한다. will/useWillProcessing.js와 달리
// job.errorMessage(AI 실패 사유)는 쓰지 않고 항상 이 문구만 보여준다 - 이유는
// pollVideoReady의 'failed' 분기 주석 참고.
const GIFT_WILL_FAILURE_MESSAGE =
  '죄송합니다. 영상 편지를 만드는 데 문제가 발생했어요. 결제하신 금액은 선물을 ' +
  '보내주신 분께 자동으로 환불되며, 따로 하실 일은 없어요.'

function useGiftPerformWill() {
  const giftId = sessionStorage.getItem('giftContentGiftId')

  const [step, setStep] = useState(STEP.CONSENT)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const [profileImageUrl, setProfileImageUrl] = useState(null)
  const [voiceSampleId, setVoiceSampleId] = useState(null)
  const [title, setTitle] = useState('')
  const [contentText, setContentText] = useState('')
  const [beneficiary, setBeneficiary] = useState({ name: '', email: '', phone: '', relationship: '' })

  // FIX: 결함A - 선물 수행 경로는 이 화면이 유일한 동의 접점인데 voice 하나만
  // 저장했다. 일반 경로(useWillConsent.js)와 동일하게 4개 전부(초상권/음성권/
  // AI 생성물/사후 공개) 받는다 - 문구는 WILL_CONSENT_ITEMS(단일 소스)를 그대로 쓴다.
  const { consents, allChecked, toggleItem, toggleAll } = useConsentChecklist(WILL_CONSENT_ITEMS)

  const pollRef = useRef(null)
  useEffect(() => () => clearInterval(pollRef.current), [])

  // ep-006: 비동기 클릭 핸들러는 setState보다 먼저 반영되는 ref로 즉시 잠근다
  // (busy state 갱신 전에 도착하는 연타로 인한 중복 POST 방지).
  const consentPendingRef = useRef(false)

  const submitConsent = useCallback(async () => {
    if (!allChecked || consentPendingRef.current) return
    consentPendingRef.current = true
    setBusy(true)
    setError(null)
    try {
      const consentPayload = WILL_CONSENT_ITEMS.map((item) => ({
        consentType: item.key,
        isAgreed: consents[item.key] ?? false,
      }))
      // FIX: D - useWillConsent.js와 동일한 저장 엔드포인트(willApi.saveConsents ->
      // POST /auth/consents)를 그대로 쓴다. 실패 시(빈 catch{} 금지) 사용자에게 알리고
      // 다음 단계(사진 업로드)로 넘어가지 못하게 막는다 - 서버 기록이 법적 증빙이다.
      await willApi.saveConsents(consentPayload)
      setStep(STEP.PHOTO)
    } catch (err) {
      setError(err?.response?.data?.message ?? '동의 저장에 실패했습니다. 잠시 후 다시 시도해 주세요.')
    } finally {
      setBusy(false)
      consentPendingRef.current = false
    }
  }, [allChecked, consents])

  const uploadProfilePhoto = useCallback(async (file) => {
    setBusy(true)
    setError(null)
    try {
      const { data } = await uploadPhoto(file)
      const url = data.data.url
      await apiClient.put('/users/me', { profileImageUrl: url })
      setProfileImageUrl(url)
      setStep(STEP.VOICE)
    } catch (err) {
      setError(err?.response?.data?.message ?? '사진 업로드에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }, [])

  const pollVoiceReady = useCallback((sampleId) => {
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await willApi.getVoiceSampleStatus(sampleId)
        const status = data.data?.cloneStatus
        if (status === 'ready') {
          clearInterval(pollRef.current)
          setVoiceSampleId(sampleId)
          setStep(STEP.MESSAGE)
        } else if (status === 'failed') {
          clearInterval(pollRef.current)
          setError('음성 처리 중 문제가 발생했습니다. 다시 녹음해 주세요.')
        }
      } catch {
        // 일시적 폴링 실패는 무시
      }
    }, 4000)
  }, [])

  const uploadVoice = useCallback(async (file) => {
    setBusy(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data: uploadRes } = await willApi.uploadAudio(formData)
      const { s3Key, size } = uploadRes.data
      const { data: sampleRes } = await willApi.createVoiceSample({ s3Key, fileSize: size })
      pollVoiceReady(sampleRes.data.voiceSampleId)
    } catch (err) {
      setError(err?.response?.data?.message ?? '음성 업로드에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }, [pollVoiceReady])

  const submitMessage = useCallback(() => {
    if (!title.trim() || !contentText.trim()) return
    setStep(STEP.BENEFICIARY)
  }, [title, contentText])

  const pollVideoReady = useCallback((willId) => {
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await willApi.getWillStatus(willId)
        // FIX: 무한 폴링 결함 - wills.status(WILL_STATUS: draft/paid/active/released/
        // revoked)에는 'failed'가 없다(shared/constants/enums.js). activateWill이
        // 큐 등록 직전에 이미 status='active'로 바꿔두기 때문에, 예전처럼
        // willStatus==='active'를 완료 신호로 쓰면 실제 영상 생성이 시작되기도 전인
        // 첫 폴링에서 곧바로 "완성됐어요"로 넘어가는 오판정이 있었다(진짜 결함은
        // 이거였다 - '실패 분기가 없다'보다 근본적). 완료/실패는 반드시
        // ai_jobs.job_status(AI_JOB_STATUS: queued/running/completed/failed, job
        // 필드)로 판정한다 - will/useWillProcessing.js가 이미 이렇게 고쳐져 있다.
        const job = data.data?.job
        const jobStatus = job?.jobStatus
        if (jobStatus === 'completed') {
          clearInterval(pollRef.current)
          try {
            await completeGift(giftId, { willId })
          } catch {
            // gift 완료 표시 실패해도 영상 자체는 이미 완성됐다 - 조용히 넘어간다
          }
          setStep(STEP.DONE)
        } else if (jobStatus === 'failed') {
          // videoWorker.js의 finalizeWillFailure가 AI 처리 최종 실패 시 자동 환불하고
          // wills.status를 'draft'(또는 환불 실패 시 'paid')로 되돌린다 - 이 분기가
          // 없어 완료·실패 어느 쪽도 아닌 상태가 되어 5초마다 영원히 폴링했다.
          //
          // will/useWillProcessing.js(본인 결제 경로)는 job.errorMessage(안전 치환된
          // AI 실패 사유)를 우선 보여준다. 선물 경로는 의도적으로 다르게 한다 - 실측
          // 결과 toSafeFailureMessage가 인식하지 못하는 원문은 전부 "처리 중 문제가
          // 발생했어요..."라는 범용 문구로 떨어지는데, 이 화면에서 정말 중요한 건 AI가
          // 왜 실패했는지가 아니라 "환불은 보내주신 분(결제자)께 가고, 이 화면을 보는
          // 수행자는 할 일이 없다"는 사실이다. job.errorMessage를 그대로 노출하면 이
          // 정보가 아예 빠지므로, 여기서는 항상 GIFT_WILL_FAILURE_MESSAGE를 보여준다.
          clearInterval(pollRef.current)
          setError(GIFT_WILL_FAILURE_MESSAGE)
          setStep(STEP.ERROR)
        } else if (jobStatus && jobStatus !== 'queued' && jobStatus !== 'running') {
          // 방어적 폴백: AI_JOB_STATUS에 없는 값이 오면(스키마 변경/오탈자 등) 무한
          // 폴링에 빠지지 않도록 멈추고 새로고침을 안내한다.
          clearInterval(pollRef.current)
          setError('처리 상태를 확인할 수 없습니다. 잠시 후 페이지를 새로고침해 다시 시도해 주세요.')
          setStep(STEP.ERROR)
        }
        // queued/running(또는 job이 아직 조회되지 않는 경우)이면 다음 주기에 계속 폴링한다.
      } catch {
        // 일시적 폴링 실패는 무시
      }
    }, 5000)
  }, [giftId])

  const submitBeneficiary = useCallback(async () => {
    if (!beneficiary.name.trim() || !beneficiary.email.trim() || !beneficiary.relationship.trim()) return
    if (!giftId || !voiceSampleId) return
    setBusy(true)
    setError(null)
    try {
      const { data: willRes } = await willApi.createWill({
        voiceSampleId,
        title: title.trim(),
        contentText: contentText.trim(),
        releasePolicy: 'manual_admin',
        beneficiaries: [beneficiary],
      })
      const willId = willRes.data.willId
      await attachWillOrder(giftId, willId)
      await willApi.activateWill(willId)
      setStep(STEP.GENERATING)
      pollVideoReady(willId)
    } catch (err) {
      setError(err?.response?.data?.message ?? '진행 중 문제가 발생했습니다.')
      setStep(STEP.ERROR)
    } finally {
      setBusy(false)
    }
  }, [beneficiary, giftId, voiceSampleId, title, contentText, pollVideoReady])

  return {
    STEP,
    step,
    error,
    busy,
    consentItems: WILL_CONSENT_ITEMS,
    consents,
    allChecked,
    toggleConsentItem: toggleItem,
    toggleAllConsents: toggleAll,
    profileImageUrl,
    title,
    setTitle,
    contentText,
    setContentText,
    beneficiary,
    setBeneficiary,
    submitConsent,
    uploadProfilePhoto,
    uploadVoice,
    submitMessage,
    submitBeneficiary,
    canSubmit: Boolean(giftId),
  }
}

export default useGiftPerformWill
