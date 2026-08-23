import mysql from 'mysql2/promise'
import dotenv from 'dotenv'
dotenv.config()

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  timezone: '+09:00',
  // [FIX D15] DATE 컬럼(시각 개념 없음: pets.birth_date/death_date,
  // ad_spend.period_start/period_end, subscriptions.billing_cycle_date)을 mysql2가
  // 기본 JS Date 객체로 역직렬화하면, 이후 JSON.stringify()가 항상 UTC로 변환하며
  // KST(+09:00) 자정을 전날 15:00Z로 밀어버린다 - "2015-03-01" 저장값이
  // "2015-02-28T15:00:00.000Z"로 응답되는 하루 밀림 버그(생일·기일이 하루 틀리면
  // 이 서비스에선 치명적이다). mysql2는 dateStrings에 컬럼 타입명 배열을 주면 그
  // 타입만 선택적으로 문자열로 반환한다(node_modules/mysql2/lib/helpers.js
  // typeMatch - Types[t]와 일치하는 타입만 파싱 단계에서 문자열 취급). ['DATE']만
  // 지정해 DATETIME/TIMESTAMP(시각이 실제로 의미 있는 created_at 등)는 건드리지
  // 않는다 - 그 컬럼들은 계속 JS Date 객체로 와야 시간 계산(예: 정기결제
  // next_billing_date 비교)이 그대로 동작한다.
  dateStrings: ['DATE'],
  supportBigNumbers: true,
})

// 연결 획득 시 세션 시간대를 KST로 강제 설정
pool.on('connection', (conn) => {
  conn.query("SET time_zone = '+09:00'", (err) => {
    if (err) console.error('[db] SET time_zone 실패:', err.message)
  })
})

/**
 * DB 연결 헬스 프로브 (DEV-28)
 *
 * mysql2 createPool은 lazyConnect라 실제 연결 성공/실패가 첫 쿼리 시점까지
 * 드러나지 않는다 - DB가 죽어 있어도 서버가 아무 경고 없이 부팅된다. 부팅 시
 * SELECT 1로 즉시 연결을 확인해 로그에 남긴다.
 *
 * 개발 편의를 위해 실패해도 서버 프로세스를 죽이지 않는다(process.exit 금지) -
 * DB 없이도 프론트/헬스체크 등 DB 비의존 경로는 계속 쓸 수 있게 한다. 대신
 * 실패 시 눈에 띄도록 console.error로 명확히 경고한다.
 *
 * @returns {Promise<boolean>} 연결 성공 여부
 */
export const checkDbConnection = async () => {
  try {
    const [rows] = await pool.query('SELECT 1 AS ok')
    if (rows?.[0]?.ok === 1) {
      console.log(`[db] MySQL 연결 확인됨 - host=${process.env.DB_HOST} db=${process.env.DB_NAME}`)
      return true
    }
    console.error('[db] MySQL 연결 확인 실패 - SELECT 1 응답이 예상과 다릅니다:', rows)
    return false
  } catch (err) {
    console.error(
      `[db] !!! MySQL 연결 실패 !!! host=${process.env.DB_HOST} db=${process.env.DB_NAME} - ${err.message}`,
    )
    console.error('[db] DB 의존 기능(회원가입/로그인/주문 등)이 모두 동작하지 않습니다. DB 상태를 확인하세요.')
    return false
  }
}

export default pool
