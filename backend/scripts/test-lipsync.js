/**
 * 립싱크 벤더 비교 테스트용 CLI 하네스
 * BullMQ/Express/MySQL/S3 결과 저장을 전혀 거치지 않고 어댑터를 직접 호출한다.
 * (S3 presigned URL 업/다운로드는 어댑터 내부에서 여전히 사용 - Sync.so/MuseTalk/D-ID 모두
 *  벤더에 URL로 입력을 전달해야 하기 때문. 단, DB/큐/알림 등 서버 상태는 전혀 건드리지 않는다.)
 *
 * 사용법:
 *   node scripts/test-lipsync.js --provider sync|musetalk|did --photo <path> --audio <path> --out <path>
 *
 * 예시:
 *   node scripts/test-lipsync.js --provider sync --photo ./sample.jpg --audio ./sample.mp3 --out ./result-sync.mp4
 */

import 'dotenv/config'
import { readFile, writeFile } from 'fs/promises'
import { getLipsyncAdapter } from '../src/services/lipsync/index.js'
import { pollUntilComplete, assertAllowedHost } from '../src/services/lipsync/pollHelper.js'

const parseArgs = (argv) => {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (token.startsWith('--')) {
      const key = token.slice(2)
      const value = argv[i + 1]
      args[key] = value
      i += 1
    }
  }
  return args
}

const printUsageAndExit = () => {
  console.error(
    '사용법: node scripts/test-lipsync.js --provider sync|musetalk|did --photo <path> --audio <path> --out <path>',
  )
  process.exit(1)
}

const main = async () => {
  const { provider, photo, audio, out } = parseArgs(process.argv.slice(2))

  if (!provider || !photo || !audio || !out) {
    printUsageAndExit()
  }

  const adapter = getLipsyncAdapter(provider)

  if (!adapter.isConfigured()) {
    console.error(`[test-lipsync] ${adapter.name} 벤더의 API 키가 설정되지 않았습니다 (.env 확인)`)
    process.exit(1)
  }

  console.log(`[test-lipsync] 벤더: ${adapter.name}`)
  const startedAt = Date.now()

  const photoBuffer = await readFile(photo)
  const audioBuffer = await readFile(audio)

  console.log('[test-lipsync] 벤더 API에 제출 중...')
  const { externalJobId } = await adapter.submit({ photoBuffer, audioBuffer })
  console.log(`[test-lipsync] 제출 완료. externalJobId=${externalJobId}`)

  console.log('[test-lipsync] 완료 대기 중 (폴링)...')
  const videoUrl = await pollUntilComplete(
    async (attempt) => {
      const { status, videoUrl: polledUrl } = await adapter.poll(externalJobId)
      console.log(`[test-lipsync] (${attempt + 1}회차) 상태: ${status}`)
      if (status === 'completed') {
        return { done: true, value: polledUrl }
      }
      return { done: false }
    },
    { maxAttempts: 30, intervalMs: 10000 },
  )

  assertAllowedHost(videoUrl, adapter.allowedResultHosts)

  console.log(`[test-lipsync] 영상 다운로드 중: ${videoUrl}`)
  const videoRes = await fetch(videoUrl)
  if (!videoRes.ok) {
    throw new Error(`영상 다운로드 실패 (${videoRes.status})`)
  }
  const videoBuffer = Buffer.from(await videoRes.arrayBuffer())

  await writeFile(out, videoBuffer)

  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1)
  console.log(`[test-lipsync] 완료. 저장 위치: ${out} (소요시간: ${elapsedSec}초)`)
}

main().catch((err) => {
  console.error('[test-lipsync] 오류:', err.message)
  process.exit(1)
})
