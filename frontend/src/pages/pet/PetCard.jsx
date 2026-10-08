import { useState } from 'react'
import { Link, generatePath } from 'react-router-dom'
import { ChevronDown, ChevronUp, PawPrint, Plus } from 'lucide-react'
import { ROUTES } from '../../constants/routes.js'
import { calcAgeLabel, getTodayKst } from '../../utils/petAge.js'

export const SPECIES_LABEL = {
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

// 'YYYY-MM-DD' 로 정규화(형식이 아니면 null). 날짜 유효성(2월 30일 등)은 calcAgeLabel 이 판단한다.
function toIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null
  return value.slice(0, 10)
}

// 나이 기준일: 떠난 아이는 death_date(그날의 나이로 고정). 오늘 기준이면 세월이 지날수록 계속 늘어 부정확하다.
// death_date 가 없거나 형식이 이상하면 오늘(KST)로 폴백한다. 떠난 날이 생일보다 앞선(데이터 오류) 경우는 나이를 표시하지 않는다.
function buildAgeLabel(pet, today) {
  const birthIso = toIsoDate(pet.birth_date)
  if (!birthIso) return null
  const deathIso = pet.death_date ? toIsoDate(pet.death_date) : null
  if (deathIso) {
    const atDeath = calcAgeLabel(birthIso, deathIso)
    if (atDeath) return atDeath
    if (deathIso < birthIso) return null
  }
  return calcAgeLabel(birthIso, today)
}

// 카드 안쪽(사진 + 이름·뱃지 + 생일·나이 + 무지개). 대시보드 카드(Link)와 상세 페이지 프로필(PetProfileCard)이 공유한다.
// nameAs: 이름 요소 태그(상세 페이지는 'h1')
function PetCardBody({ pet, isMemorial, nameAs: NameTag = 'span' }) {
  const [imgFailed, setImgFailed] = useState(false)
  // 오늘(KST)은 마운트 시 한 번만 구한다(자정 넘김 갱신 불필요)
  const [today] = useState(getTodayKst)
  const showImage = Boolean(pet.profile_image_url) && !imgFailed
  const speciesLabel = SPECIES_LABEL[pet.species] ?? pet.species ?? '기타'
  const breed = typeof pet.breed === 'string' ? pet.breed.trim() : ''
  const birth = formatDate(pet.birth_date)
  const age = birth ? buildAgeLabel(pet, today) : null
  const birthLine = birth ? (age ? `생일 ${birth} · ${age}` : `생일 ${birth}`) : null

  return (
    <>
      <span className="pet-card__main">
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
          <NameTag className="pet-card__name">{pet.name}</NameTag>
          <span className="pet-card__kind">
            <span className="pet-card__badge pet-card__badge--species">{speciesLabel}</span>
            {breed && <span className="pet-card__badge pet-card__badge--breed">{breed}</span>}
          </span>
          {birthLine && <span className="pet-card__birth">{birthLine}</span>}
        </span>
      </span>
      {isMemorial && (
        <>
          <span className="pet-card__rainbow" aria-hidden="true">🌈</span>
          <span className="sr-only">무지개다리를 건넌 아이</span>
        </>
      )}
    </>
  )
}

function buildCardClass(pet, isMemorial, extra = '') {
  const noBirth = formatDate(pet.birth_date) ? '' : ' pet-card--no-birth'
  return `pet-card pet-card--pet${isMemorial ? ' pet-card--memorial' : ''}${noBirth}${extra}`
}

export function PetCard({ pet, variant = 'default' }) {
  const isMemorial = variant === 'memorial'
  return (
    <Link
      to={generatePath(ROUTES.PET_DETAIL, { petId: pet.pet_id })}
      data-species={pet.species}
      className={buildCardClass(pet, isMemorial)}
    >
      <PetCardBody pet={pet} isMemorial={isMemorial} />
    </Link>
  )
}

// 링크 없는 표시용 카드(상세 페이지 맨 위 프로필). PetCard 와 같은 마크업·스타일, 자기 자신으로 가는 링크만 없다.
export function PetProfileCard({ pet, isMemorial = false, nameAs = 'h1', ...rest }) {
  return (
    <section
      data-species={pet.species}
      className={buildCardClass(pet, isMemorial, ' pet-card--static')}
      {...rest}
    >
      <PetCardBody pet={pet} isMemorial={isMemorial} nameAs={nameAs} />
    </section>
  )
}

// 카드(<Link>) 안에 button 을 넣을 수 없어 li 안에서 카드와 형제로 둔다. 위치는 CSS 로 카드 오른쪽 아래.
export function PetReorderButtons({ name, canEarlier, canLater, onEarlier, onLater, registerButton }) {
  return (
    <div className="pet-card__reorder">
      <button
        type="button"
        className="pet-card__reorder-btn"
        ref={(node) => registerButton('earlier', node)}
        onClick={onEarlier}
        disabled={!canEarlier}
        aria-label={`${name} 앞으로 이동`}
      >
        <ChevronUp size={20} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="pet-card__reorder-btn"
        ref={(node) => registerButton('later', node)}
        onClick={onLater}
        disabled={!canLater}
        aria-label={`${name} 뒤로 이동`}
      >
        <ChevronDown size={20} aria-hidden="true" />
      </button>
    </div>
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
