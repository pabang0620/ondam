/**
 * Socket.IO 인스턴스 공유 모듈
 * server.js에서 setIo()로 등록, 워커 등 다른 모듈에서 getIo()로 참조
 */

let _io = null

/**
 * io 인스턴스 등록 (server.js에서 초기화 시 호출)
 * @param {import('socket.io').Server} io
 */
export const setIo = (io) => {
  _io = io
}

/**
 * io 인스턴스 반환
 * socket.io가 초기화되지 않은 환경(워커 독립 실행 등)에서는 null 반환
 * @returns {import('socket.io').Server|null}
 */
export const getIo = () => _io
