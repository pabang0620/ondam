/**
 * 정지 사진(Buffer) → 짧은 mp4 영상(Buffer) 변환
 * Sync.so / MuseTalk(Fal.ai)는 립싱크 입력으로 "영상"을 요구하므로,
 * 프로필 사진을 같은 프레임을 반복하는 짧은 mp4로 먼저 변환해서 넘긴다.
 *
 * 시스템에 ffmpeg 바이너리가 설치돼 있지 않은 환경(컨테이너 등)을 기본 가정하고
 * ffmpeg-static(바이너리 번들 npm 패키지)을 기본 경로로 사용한다.
 * FFMPEG_PATH 환경변수가 설정된 경우 그 경로를 우선 사용한다(운영 환경에 시스템 ffmpeg가 있는 경우).
 */

import { promises as fs } from 'fs'
import os from 'os'
import path from 'path'
import { randomUUID } from 'crypto'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegStaticPath from 'ffmpeg-static'

const resolvedFfmpegPath = process.env.FFMPEG_PATH || ffmpegStaticPath
if (resolvedFfmpegPath) {
  ffmpeg.setFfmpegPath(resolvedFfmpegPath)
}

const MAX_PHOTO_BUFFER_BYTES = 50 * 1024 * 1024 // 50MB
const MIN_DURATION_SEC = 1
const MAX_DURATION_SEC = 300

/**
 * @param {Buffer} photoBuffer - 원본 사진 (jpg/png 등)
 * @param {{ durationSec?: number }} options
 * @returns {Promise<Buffer>} mp4 영상 Buffer
 */
export const convertPhotoToVideo = async (photoBuffer, { durationSec = 8 } = {}) => {
  if (!resolvedFfmpegPath) {
    throw Object.assign(
      new Error('ffmpeg 바이너리를 찾을 수 없습니다 (ffmpeg-static 설치 확인 또는 FFMPEG_PATH 환경변수 설정 필요)'),
      { status: 500 },
    )
  }
  if (!photoBuffer || photoBuffer.length === 0) {
    throw Object.assign(new Error('변환할 사진 데이터가 없습니다'), { status: 400 })
  }
  // durationSec이 사용자 입력에서 흘러들어올 경우 ffmpeg 명령 인자 조작 및
  // 비정상적으로 긴 렌더링(리소스 고갈)을 방지하기 위한 검증
  if (!Number.isInteger(durationSec) || durationSec < MIN_DURATION_SEC || durationSec > MAX_DURATION_SEC) {
    throw Object.assign(
      new Error(`durationSec은 ${MIN_DURATION_SEC}~${MAX_DURATION_SEC} 사이의 정수여야 합니다`),
      { status: 400 },
    )
  }
  if (photoBuffer.length > MAX_PHOTO_BUFFER_BYTES) {
    throw Object.assign(
      new Error(`사진 파일 크기가 너무 큽니다 (최대 ${MAX_PHOTO_BUFFER_BYTES / (1024 * 1024)}MB)`),
      { status: 413 },
    )
  }

  const jobId = randomUUID()
  const tmpDir = os.tmpdir()
  const inputPath = path.join(tmpDir, `ondam-lipsync-photo-${jobId}.jpg`)
  const outputPath = path.join(tmpDir, `ondam-lipsync-video-${jobId}.mp4`)

  try {
    await fs.writeFile(inputPath, photoBuffer)

    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .inputOptions(['-loop 1'])
        .outputOptions([
          '-c:v libx264',
          `-t ${durationSec}`,
          '-pix_fmt yuv420p',
          // 벤더 대부분 정사각/세로 인물샷을 무난하게 처리 - 원본 비율 유지한 채 1024x1024 안에 레터박스
          // TODO: 벤더별 권장 해상도/종횡비 공식 문서로 재확인 필요
          '-vf scale=1024:1024:force_original_aspect_ratio=decrease,pad=1024:1024:(ow-iw)/2:(oh-ih)/2,setsar=1',
          '-r 25',
          '-movflags +faststart',
        ])
        .on('error', (err) => {
          reject(Object.assign(new Error(`ffmpeg 사진→영상 변환 실패: ${err.message}`), { status: 500 }))
        })
        .on('end', resolve)
        .save(outputPath)
    })

    return await fs.readFile(outputPath)
  } finally {
    await fs.unlink(inputPath).catch(() => {})
    await fs.unlink(outputPath).catch(() => {})
  }
}
