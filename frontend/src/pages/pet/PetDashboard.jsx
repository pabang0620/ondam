import { PetCard, PetAddCard } from './PetCard.jsx'
import PetSubscriptionSummary from './PetSubscriptionSummary.jsx'
import './PetDashboard.css'

// showAdd: 추가 카드는 화면의 마지막 그리드 끝에만 둔다.
function AliveSection({ pets, showAdd }) {
  return (
    <section className="pet-dash__section" aria-labelledby="pet-alive-title">
      <h2 id="pet-alive-title" className="pet-dash__section-title">함께하는 아이들</h2>
      <ul className="pet-card-grid" role="list">
        {pets.map((pet) => (
          <li key={pet.pet_id}><PetCard pet={pet} /></li>
        ))}
        {showAdd && <li><PetAddCard /></li>}
      </ul>
    </section>
  )
}

// 제목 없는 별도 그리드(같은 열 규칙). 의미는 카드의 무지개 표시와 sr-only 텍스트가 전달한다.
function MemorialGrid({ pets }) {
  return (
    <ul className="pet-card-grid" role="list">
      {pets.map((pet) => (
        <li key={pet.pet_id}><PetCard pet={pet} variant="memorial" /></li>
      ))}
      <li><PetAddCard /></li>
    </ul>
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
          {alivePets.length > 0 && (
            <AliveSection pets={alivePets} showAdd={deceasedPets.length === 0} />
          )}
          {deceasedPets.length > 0 && <MemorialGrid pets={deceasedPets} />}
          {summaryNode}
        </>
      )}
    </div>
  )
}
