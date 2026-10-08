import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpDown, Plus } from 'lucide-react'
import { ROUTES } from '../../constants/routes.js'
import { PetCard, PetAddCard, PetReorderButtons } from './PetCard.jsx'
import PetSubscriptionSummary from './PetSubscriptionSummary.jsx'
import { usePetOrder } from './usePetOrder.js'
import { usePetReorderControls } from './usePetReorderControls.js'
import { useAuthStore } from '../../store/authStore.js'
import './PetDashboard.css'

// 순서 변경 토글(제목 줄)
function ReorderToggle({ reorderMode, onToggle }) {
  return (
    <button
      type="button"
      className="pet-dash__reorder-toggle"
      aria-pressed={reorderMode}
      aria-label={reorderMode ? '순서 변경 끝내기' : '순서 변경'}
      onClick={onToggle}
    >
      <ArrowUpDown size={20} aria-hidden="true" />
    </button>
  )
}

// 생존·무지개다리 카드 모두 같은 li + 같은 이동 버튼. 무지개다리는 카드 변형(표시)만 다르다.
function ReorderableItem({ pet, reorderOn, list }) {
  const { handleMove, registerButton, canMoveEarlier, canMoveLater } = list
  const variant = pet.pet_status === 'deceased' ? 'memorial' : 'default'
  return (
    <li className={reorderOn ? 'pet-card-item--reorder' : undefined}>
      <PetCard pet={pet} variant={variant} />
      {reorderOn && (
        <PetReorderButtons
          name={pet.name}
          canEarlier={canMoveEarlier(pet.pet_id)}
          canLater={canMoveLater(pet.pet_id)}
          onEarlier={() => handleMove(pet, 'earlier')}
          onLater={() => handleMove(pet, 'later')}
          registerButton={registerButton(pet.pet_id)}
        />
      )}
    </li>
  )
}

// '함께하는 아이들': 생존 + 무지개다리 카드를 하나의 목록·하나의 순서로 보여준다.
function PetListSection({ pets, reorderMode, onToggleReorder }) {
  const userId = useAuthStore((s) => s.user?.userId)
  const order = usePetOrder(userId, pets)
  const list = { ...order, ...usePetReorderControls(order) }
  // 2마리 미만이면 모드 값과 무관하게 이동 UI 는 꺼진 것으로 본다
  const canReorder = list.orderedPets.length > 1
  const reorderOn = canReorder && reorderMode

  return (
    <section className="pet-dash__section" aria-labelledby="pet-alive-title">
      <div className="pet-dash__section-head">
        <h2 id="pet-alive-title" className="pet-dash__section-title">함께하는 아이들</h2>
        <div className="pet-dash__section-actions">
          {canReorder && <ReorderToggle reorderMode={reorderMode} onToggle={onToggleReorder} />}
          <Link to={ROUTES.PET_NEW} className="pet-dash__add" aria-label="반려동물 추가">
            <Plus size={24} aria-hidden="true" />
          </Link>
        </div>
      </div>
      {canReorder && (
        <p className="sr-only" aria-live="polite" aria-atomic="true">{list.announcement}</p>
      )}
      <ul className="pet-card-grid" role="list">
        {list.orderedPets.map((pet) => (
          <ReorderableItem key={pet.pet_id} pet={pet} reorderOn={reorderOn} list={list} />
        ))}
        <li><PetAddCard /></li>
      </ul>
    </section>
  )
}

function ErrorBlock({ message, onRetry }) {
  return (
    <div className="pet-dash__error">
      <p role="alert">{message}</p>
      <button type="button" className="pet-dash__retry" onClick={onRetry}>다시 시도</button>
    </div>
  )
}

export default function PetDashboard({
  alivePets = [],
  deceasedPets = [],
  error = null,
  onRetry,
  subscription = {},
  checkout,
  price,
  canSubscribe = false,
}) {
  const [reorderMode, setReorderMode] = useState(false)
  const toggleReorder = () => setReorderMode((prev) => !prev)
  // 생존이 앞, 이후 무지개다리(기본 순서). 저장된 순서가 있으면 usePetOrder 가 그 위에 적용한다.
  const pets = useMemo(() => [...alivePets, ...deceasedPets], [alivePets, deceasedPets])
  const { summary = null, isLoading = false, error: subError = null, isStale = false, refetch } = subscription
  const summaryNode = (
    <PetSubscriptionSummary
      summary={summary}
      isLoading={isLoading}
      error={subError}
      isStale={isStale}
      onSubscriptionChanged={refetch}
      onRetry={refetch}
      checkout={checkout}
      price={price}
      canSubscribe={canSubscribe}
    />
  )

  return (
    <div className="pet-dash">
      <h1 className="sr-only">내 반려동물</h1>
      {error ? (
        <ErrorBlock message={error} onRetry={onRetry} />
      ) : (
        <>
          {pets.length > 0 && (
            <PetListSection
              pets={pets}
              reorderMode={reorderMode}
              onToggleReorder={toggleReorder}
            />
          )}
          {summaryNode}
        </>
      )}
    </div>
  )
}
