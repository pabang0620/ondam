import { useCallback, useMemo, useState } from 'react'

const STORAGE_PREFIX = 'ondam:pet-order:v1:'

function storageKey(userId) {
  return `${STORAGE_PREFIX}${userId}`
}

// 저장 문자열 -> pet_id 배열. 배열이 아니거나 문자열이 아닌 요소가 섞이면 통째로 버린다(변조·손상 방어).
export function parseStoredOrder(raw) {
  if (typeof raw !== 'string') return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    if (!parsed.every((id) => typeof id === 'string' && id.length > 0)) return []
    return parsed
  } catch {
    return []
  }
}

// 저장된 순서 기준으로 현재 pets 를 정렬. 사라진 id 는 제외, 저장에 없는 새 pet 은 서버 순서대로 맨 뒤.
export function reconcileOrder(savedIds, pets) {
  const byId = new Map(pets.map((pet) => [pet.pet_id, pet]))
  const seen = new Set()
  const kept = []
  for (const id of savedIds) {
    if (byId.has(id) && !seen.has(id)) {
      seen.add(id)
      kept.push(byId.get(id))
    }
  }
  const appended = pets.filter((pet) => !seen.has(pet.pet_id))
  return [...kept, ...appended]
}

// ids 에서 id 를 delta(-1/+1) 만큼 인접 교환한 새 배열. 범위 밖이거나 없는 id 면 null.
export function swapAdjacent(ids, id, delta) {
  const from = ids.indexOf(id)
  const to = from + delta
  if (from === -1 || to < 0 || to >= ids.length) return null
  const next = [...ids]
  next[from] = ids[to]
  next[to] = ids[from]
  return next
}

function readOrder(userId) {
  if (!userId) return []
  try {
    return parseStoredOrder(window.localStorage.getItem(storageKey(userId)))
  } catch {
    return []
  }
}

function writeOrder(userId, ids) {
  if (!userId) return
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(ids))
  } catch {
    // 저장 차단 환경: 메모리 상태로만 동작
  }
}

// 모든 반려동물(생존 + 무지개다리)을 하나의 순서로 저장한다.
export function usePetOrder(userId, pets) {
  const [store, setStore] = useState(() => ({ userId, order: readOrder(userId) }))

  // 사용자가 바뀌면 그 저장 순서로 교체(렌더 중 상태 조정)
  const isCurrent = store.userId === userId
  if (!isCurrent) {
    setStore({ userId, order: readOrder(userId) })
  }
  const order = isCurrent ? store.order : []

  const orderedPets = useMemo(() => reconcileOrder(order, pets), [order, pets])

  const move = useCallback(
    (petId, delta) => {
      const next = swapAdjacent(orderedPets.map((pet) => pet.pet_id), petId, delta)
      if (!next) return false
      setStore({ userId, order: next })
      writeOrder(userId, next)
      return true
    },
    [orderedPets, userId],
  )

  const moveEarlier = useCallback((petId) => move(petId, -1), [move])
  const moveLater = useCallback((petId) => move(petId, 1), [move])
  const canMoveEarlier = useCallback(
    (petId) => orderedPets.findIndex((pet) => pet.pet_id === petId) > 0,
    [orderedPets],
  )
  const canMoveLater = useCallback((petId) => {
    const index = orderedPets.findIndex((pet) => pet.pet_id === petId)
    return index !== -1 && index < orderedPets.length - 1
  }, [orderedPets])

  return { orderedPets, moveEarlier, moveLater, canMoveEarlier, canMoveLater }
}

export default usePetOrder
