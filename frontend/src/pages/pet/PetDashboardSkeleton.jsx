const SKELETON_CARD_COUNT = 3

export default function PetDashboardSkeleton() {
  return (
    <div className="pet-dash pet-skeleton" aria-busy="true">
      <p className="sr-only" role="status">반려동물 정보를 불러오는 중이에요</p>
      <div className="pet-skeleton__title" aria-hidden="true" />
      <div className="pet-card-grid" aria-hidden="true">
        {Array.from({ length: SKELETON_CARD_COUNT }, (_, i) => (
          <div key={i} className="pet-skeleton__card" aria-hidden="true" />
        ))}
      </div>
    </div>
  )
}
