import { useEffect, useRef, useState } from 'react'

// 순서 변경 목록 공용: 이동 처리, 이동 후 포커스 복귀, 스크린리더 안내.
export function usePetReorderControls({ orderedPets, moveEarlier, moveLater }) {
  const [announcement, setAnnouncement] = useState('')
  const buttonRefs = useRef(new Map())
  const pendingFocus = useRef(null)

  // 이동 후 노드가 재배치되며 포커스를 잃을 수 있어, 같은 버튼(비활성이면 반대 버튼)으로 되돌린다.
  useEffect(() => {
    const pending = pendingFocus.current
    if (!pending) return
    pendingFocus.current = null
    const opposite = pending.direction === 'earlier' ? 'later' : 'earlier'
    const target = [pending.direction, opposite]
      .map((dir) => buttonRefs.current.get(`${pending.petId}:${dir}`))
      .find((node) => node && !node.disabled)
    target?.focus()
  }, [orderedPets])

  const handleMove = (pet, direction) => {
    const index = orderedPets.findIndex((item) => item.pet_id === pet.pet_id)
    const moved = direction === 'earlier' ? moveEarlier(pet.pet_id) : moveLater(pet.pet_id)
    if (!moved) return
    pendingFocus.current = { petId: pet.pet_id, direction }
    const newPosition = direction === 'earlier' ? index : index + 2
    setAnnouncement(`${pet.name}을(를) ${newPosition}번째로 옮겼어요`)
  }

  const registerButton = (petId) => (direction, node) => {
    const key = `${petId}:${direction}`
    if (node) buttonRefs.current.set(key, node)
    else buttonRefs.current.delete(key)
  }

  return { handleMove, registerButton, announcement }
}

export default usePetReorderControls
