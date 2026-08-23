/**
 * 개발용 관리자 계정 시드 스크립트 (DEV-05 부속)
 *
 * 로컬 DB의 admin_users에 있는 기존 3개 계정(super@ondam.test 등)은 원본
 * 비밀번호를 레포 어디서도 찾을 수 없어 로그인 테스트가 불가능했다. 이 스크립트는
 * 그 계정을 건드리지 않고, 알려진 비밀번호를 가진 별도의 개발용 계정을 role별로
 * 새로 만든다.
 *
 * 사용법:
 *   node scripts/seed-admin.js                       # role 3종 기본 계정 모두 생성
 *   node scripts/seed-admin.js --role=super           # 특정 role만 생성
 *   node scripts/seed-admin.js --email=a@b.com --role=manager --password=xxxx
 *   node scripts/seed-admin.js --force                # 이미 있으면 비밀번호 재설정
 *
 * 비밀번호는 --password 인자 또는 ADMIN_SEED_PASSWORD 환경변수로 지정한다.
 * 둘 다 없으면 개발용 기본값을 쓰고 콘솔에 크게 경고한다(하드코딩된 실제 운영
 * 비밀번호가 아니라 "미지정 시 fallback"일 뿐 - 안전장치 3번째 항목 참고).
 *
 * 안전장치:
 *   1) NODE_ENV === 'production'이면 즉시 중단
 *   2) 이메일이 이미 존재하면 기본은 건너뛰고, --force가 있어야 비밀번호를 재설정
 *   3) 비밀번호 하드코딩 없음 - 인자/환경변수 미지정 시에만 fallback을 쓰고 경고 출력
 */

import bcrypt from 'bcrypt'
import { v4 as uuidv4 } from 'uuid'
import pool from '../src/config/db.js'

// authService.js / userService.js와 동일한 cost factor(12)를 사용한다 - 이 프로젝트의
// bcrypt 컨벤션. adminService.login()의 bcrypt.compare()가 그대로 검증할 수 있어야 한다.
const BCRYPT_ROUNDS = 12

// admin_users.admin_role ENUM('super','manager','reviewer') - ondam_schema.sql 실측값
const DEFAULT_ACCOUNTS = [
  { role: 'super', email: 'dev-super@ondam.dev', name: '개발용 슈퍼관리자' },
  { role: 'manager', email: 'dev-manager@ondam.dev', name: '개발용 결제담당' },
  { role: 'reviewer', email: 'dev-reviewer@ondam.dev', name: '개발용 검수담당' },
]

const DEV_FALLBACK_PASSWORD = 'ondam-dev-1234!'

const parseArgs = (argv) => {
  const args = { force: false }
  for (const raw of argv) {
    if (raw === '--force') {
      args.force = true
      continue
    }
    const match = raw.match(/^--([a-zA-Z]+)=(.*)$/)
    if (match) args[match[1]] = match[2]
  }
  return args
}

const findExisting = async (email) => {
  const [rows] = await pool.query(
    `SELECT admin_id, email FROM admin_users WHERE email = ? AND deleted_at IS NULL`,
    [email],
  )
  return rows[0] ?? null
}

const insertAdmin = async ({ email, passwordHash, name, role }) => {
  const adminId = uuidv4()
  await pool.query(
    `INSERT INTO admin_users (admin_id, email, password_hash, name, admin_role, is_active)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [adminId, email, passwordHash, name, role],
  )
  return adminId
}

const updatePassword = async (adminId, passwordHash) => {
  await pool.query(
    `UPDATE admin_users SET password_hash = ?, is_active = 1 WHERE admin_id = ?`,
    [passwordHash, adminId],
  )
}

const seedOne = async ({ email, name, role }, password, force) => {
  const existing = await findExisting(email)
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

  if (existing) {
    if (!force) {
      console.log(`  [건너뜀] ${email} (이미 존재, --force로 비밀번호 재설정 가능)`)
      return { email, role, status: 'skipped' }
    }
    await updatePassword(existing.admin_id, passwordHash)
    console.log(`  [재설정] ${email} (adminId=${existing.admin_id})`)
    return { email, role, status: 'updated', adminId: existing.admin_id }
  }

  const adminId = await insertAdmin({ email, passwordHash, name, role })
  console.log(`  [생성]   ${email} (adminId=${adminId})`)
  return { email, role, status: 'created', adminId }
}

const main = async () => {
  // 안전장치 1: 운영 환경에서는 절대 실행하지 않는다
  if (process.env.NODE_ENV === 'production') {
    console.error('\n[seed-admin] NODE_ENV=production 에서는 이 스크립트를 실행할 수 없습니다. 중단합니다.\n')
    process.exit(1)
  }

  const args = parseArgs(process.argv.slice(2))
  const password = args.password ?? process.env.ADMIN_SEED_PASSWORD ?? DEV_FALLBACK_PASSWORD

  if (!args.password && !process.env.ADMIN_SEED_PASSWORD) {
    console.warn(
      '\n' +
      '========================================================================\n' +
      '  [seed-admin] 비밀번호가 지정되지 않아 개발용 기본값을 사용합니다.\n' +
      `  기본 비밀번호: ${DEV_FALLBACK_PASSWORD}\n` +
      '  운영 DB에는 절대 이 값을 쓰지 마세요. 로컬 개발 전용입니다.\n' +
      '  --password=xxxx 또는 ADMIN_SEED_PASSWORD 환경변수로 바꿀 수 있습니다.\n' +
      '========================================================================\n',
    )
  }

  const targets = args.role
    ? [
        {
          role: args.role,
          email: args.email ?? DEFAULT_ACCOUNTS.find((a) => a.role === args.role)?.email,
          name: args.name ?? `개발용 ${args.role} 관리자`,
        },
      ]
    : DEFAULT_ACCOUNTS

  const validRoles = ['super', 'manager', 'reviewer']
  for (const t of targets) {
    if (!validRoles.includes(t.role)) {
      console.error(`[seed-admin] 알 수 없는 role: ${t.role} (허용: ${validRoles.join(', ')})`)
      process.exit(1)
    }
    if (!t.email) {
      console.error(`[seed-admin] role=${t.role}에 대응하는 email이 없습니다. --email=... 을 지정하세요.`)
      process.exit(1)
    }
  }

  console.log(`[seed-admin] ${targets.length}개 계정 처리 시작 (force=${args.force})\n`)

  const results = []
  for (const t of targets) {
    results.push(await seedOne(t, password, args.force))
  }

  console.log('\n[seed-admin] 완료. 아래 계정으로 로그인 가능(개발 DB 전용):')
  for (const r of results) {
    if (r.status !== 'skipped') {
      console.log(`  - email=${r.email}  password=${password}  role=${r.role}`)
    }
  }

  await pool.end()
}

main().catch((err) => {
  console.error('[seed-admin] 실패:', err)
  process.exit(1)
})
