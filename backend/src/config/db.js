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
  dateStrings: false,
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
