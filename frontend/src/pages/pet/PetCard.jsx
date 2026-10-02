import { useState } from 'react'
import { Link, generatePath } from 'react-router-dom'
import { PawPrint, Plus } from 'lucide-react'
import { ROUTES } from '../../constants/routes.js'

const SPECIES_LABEL = {
  dog: '강아지',
  cat: '고양이',
  rabbit: '토끼',
  bird: '새',
  hamster: '햄스터',
  fish: '물고기',
  reptile: '파충류',
  other: '기타',
}

const PHOTO_SIZE = 96

// 'YYYY-MM-DD...' 문자열을 'YYYY.MM.DD' 로. new Date 는 시간대 때문에 하루 밀릴 수 있어 쓰지 않는다.
function formatDate(value) {
  if (typeof value !== 'string' || value.length < 10) return null
  return value.slice(0, 10).replaceAll('-', '.')
}

function buildDates(pet) {
  const birth = formatDate(pet.birth_date)
  const death = formatDate(pet.death_date)
  if (birth && death) return `${birth} ~ ${death}`
  if (birth) return `${birth} ~`
  if (death) return `~ ${death}`
  return null
}

export function PetCard({ pet, variant = 'default' }) {
  const [imgFailed, setImgFailed] = useState(false)
  const showImage = Boolean(pet.profile_image_url) && !imgFailed
  const speciesLabel = SPECIES_LABEL[pet.species] ?? pet.species ?? '기타'
  const breed = typeof pet.breed === 'string' ? pet.breed.trim() : ''
  const kindLine = breed ? `${speciesLabel} · ${breed}` : speciesLabel
  const birth = formatDate(pet.birth_date)
  const dateLine = variant === 'memorial' ? buildDates(pet) : birth ? `생일 ${birth}` : null

  return (
    <Link
      to={generatePath(ROUTES.PET_DETAIL, { petId: pet.pet_id })}
      className={`pet-card pet-card--${variant}`}
    >
      <span className="pet-card__photo">
        {showImage ? (
          <img
            src={pet.profile_image_url}
            alt=""
            width={PHOTO_SIZE}
            height={PHOTO_SIZE}
            loading="lazy"
            decoding="async"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <PawPrint size={32} aria-hidden="true" />
        )}
      </span>
      <span className="pet-card__info">
        <span className="pet-card__name">{pet.name}</span>
        <span className="pet-card__species">{kindLine}</span>
        {dateLine && <span className="pet-card__dates">{dateLine}</span>}
      </span>
      {variant === 'memorial' && (
        <>
          <span className="pet-card__rainbow" aria-hidden="true">🌈</span>
          <span className="sr-only">무지개다리를 건넌 아이</span>
        </>
      )}
    </Link>
  )
}

export function PetAddCard() {
  return (
    <Link to={ROUTES.PET_NEW} className="pet-card pet-card--add">
      <span className="pet-card__photo pet-card__photo--add">
        <Plus size={16} aria-hidden="true" />
        <span className="sr-only">반려동물 추가</span>
      </span>
      <span className="pet-card__info pet-card__info--add">
        회원님과 함께하는 아이를 등록해주세요.
      </span>
    </Link>
  )
}

export default PetCard
