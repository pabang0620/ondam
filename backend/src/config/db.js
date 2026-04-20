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

export default pool
