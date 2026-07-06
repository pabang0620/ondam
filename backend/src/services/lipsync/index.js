/**
 * 립싱크 벤더 어댑터 레지스트리
 * LIPSYNC_PROVIDER 환경변수 값 하나로 벤더를 교체할 수 있게 한다.
 * 각 어댑터는 { name, allowedResultHosts, isConfigured(), submit({photoBuffer, audioBuffer}), poll(externalJobId) } 를 export.
 */

import * as syncSo from './syncSo.js'
import * as museTalk from './museTalk.js'
import * as did from './did.js'

const ADAPTERS = {
  sync: syncSo,
  musetalk: museTalk,
  did,
}

/**
 * @param {string} [providerName] - 미지정 시 LIPSYNC_PROVIDER 환경변수, 그마저 없으면 'sync'
 * @returns {typeof syncSo}
 */
export const getLipsyncAdapter = (providerName = process.env.LIPSYNC_PROVIDER || 'sync') => {
  const adapter = ADAPTERS[providerName]
  if (!adapter) {
    throw Object.assign(
      new Error(`알 수 없는 립싱크 벤더: ${providerName} (사용 가능: ${Object.keys(ADAPTERS).join(', ')})`),
      { status: 500 },
    )
  }
  return adapter
}
