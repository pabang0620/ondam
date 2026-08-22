import { Trash2, Pencil, X } from 'lucide-react'
import { useAdminAdSpend } from './useAdminAdSpend.js'
import './admin.css'

const inputStyle = {
  border: '1.5px solid var(--color-border-strong)',
  borderRadius: 'var(--radius-sm)',
  padding: '0 var(--spacing-md)',
  minHeight: 'var(--size-input-h)',
  fontSize: 'var(--fs-body)',
  width: '100%',
  outline: 'none',
  background: 'var(--color-surface)',
  color: 'var(--color-text-primary)',
  boxSizing: 'border-box',
}

const labelStyle = {
  display: 'block',
  fontSize: 'var(--fs-caption)',
  fontWeight: 600,
  color: 'var(--color-text-secondary)',
  marginBottom: 4,
}

const thStyle = {
  padding: '12px 16px',
  textAlign: 'left',
  fontWeight: 700,
  color: 'var(--color-primary)',
  borderBottom: '2px solid var(--color-border-strong)',
  whiteSpace: 'nowrap',
  fontSize: 'var(--fs-body)',
}

const tdStyle = {
  padding: '12px 16px',
  fontSize: 'var(--fs-body)',
  borderBottom: '1px solid var(--color-border)',
  verticalAlign: 'middle',
  color: 'var(--color-text-primary)',
}

/* 광고비 입력 폼 - 채널은 자유입력 + 최근 사용 채널 datalist 제안 */
function AdSpendForm({
  form, updateField, recentChannels, editingId, cancelEdit, submitForm, isSaving, formError,
}) {
  return (
    <form
      onSubmit={submitForm}
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-card)',
        padding: 'var(--spacing-xl)',
        marginBottom: 'var(--spacing-xl)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-md)',
      }}
    >
      <h2 style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 700, color: 'var(--color-primary)' }}>
        {editingId ? '광고비 수정' : '광고비 입력'}
      </h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--spacing-md)' }}>
        <div>
          <label style={labelStyle} htmlFor="ad-spend-channel">채널</label>
          <input
            id="ad-spend-channel"
            list="ad-spend-recent-channels"
            value={form.channel}
            onChange={(e) => updateField('channel', e.target.value)}
            placeholder="예: meta, youtube"
            style={inputStyle}
          />
          <datalist id="ad-spend-recent-channels">
            {recentChannels.map((ch) => <option key={ch} value={ch} />)}
          </datalist>
        </div>

        <div>
          <label style={labelStyle} htmlFor="ad-spend-start">시작일</label>
          <input
            id="ad-spend-start"
            type="date"
            value={form.periodStart}
            onChange={(e) => updateField('periodStart', e.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle} htmlFor="ad-spend-end">종료일</label>
          <input
            id="ad-spend-end"
            type="date"
            value={form.periodEnd}
            onChange={(e) => updateField('periodEnd', e.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle} htmlFor="ad-spend-krw">광고비(원)</label>
          <input
            id="ad-spend-krw"
            type="number"
            min="0"
            value={form.spendKrw}
            onChange={(e) => updateField('spendKrw', e.target.value)}
            placeholder="0"
            style={inputStyle}
          />
        </div>
      </div>

      <div>
        <label style={labelStyle} htmlFor="ad-spend-note">메모 (캠페인명 등)</label>
        <input
          id="ad-spend-note"
          type="text"
          value={form.note}
          onChange={(e) => updateField('note', e.target.value)}
          placeholder="선택 입력"
          style={inputStyle}
        />
      </div>

      {formError && (
        <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--fs-body)' }}>
          {formError}
        </p>
      )}

      <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
        <button
          type="submit"
          disabled={isSaving}
          style={{
            background: 'var(--color-primary)',
            color: 'var(--color-surface)',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            padding: '0 var(--spacing-lg)',
            minHeight: 'var(--size-button-h)',
            fontSize: 'var(--fs-button)',
            fontWeight: 700,
            cursor: isSaving ? 'not-allowed' : 'pointer',
            opacity: isSaving ? 0.7 : 1,
          }}
        >
          {isSaving ? '저장 중...' : editingId ? '수정 완료' : '등록'}
        </button>
        {editingId && (
          <button
            type="button"
            onClick={cancelEdit}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              background: 'none',
              color: 'var(--color-text-secondary)',
              border: '1.5px solid var(--color-border-strong)',
              borderRadius: 'var(--radius-sm)',
              padding: '0 var(--spacing-lg)',
              minHeight: 'var(--size-button-h)',
              fontSize: 'var(--fs-button)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <X size={16} aria-hidden="true" />
            취소
          </button>
        )}
      </div>
    </form>
  )
}

/* CAC(고객획득비용) 조회 - 12-analytics-plan.md 3-5절, 블렌디드 산출만 가능 */
function CacPanel({ cacRange, updateCacRange, cacResult, isCacLoading, cacError, fetchCac }) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-card)',
        padding: 'var(--spacing-xl)',
        marginBottom: 'var(--spacing-xl)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--spacing-md)',
      }}
    >
      <h2 style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 700, color: 'var(--color-primary)' }}>
        CAC (고객획득비용) 조회
      </h2>

      <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <label style={labelStyle} htmlFor="cac-start">시작일</label>
          <input
            id="cac-start"
            type="date"
            value={cacRange.startDate}
            onChange={(e) => updateCacRange('startDate', e.target.value)}
            style={{ ...inputStyle, width: 180 }}
          />
        </div>
        <div>
          <label style={labelStyle} htmlFor="cac-end">종료일</label>
          <input
            id="cac-end"
            type="date"
            value={cacRange.endDate}
            onChange={(e) => updateCacRange('endDate', e.target.value)}
            style={{ ...inputStyle, width: 180 }}
          />
        </div>
        <button
          type="button"
          onClick={fetchCac}
          disabled={isCacLoading}
          style={{
            background: 'var(--color-surface-warm)',
            color: 'var(--color-primary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-pill)',
            padding: '0 var(--spacing-lg)',
            minHeight: 'var(--min-touch-target)',
            fontSize: 'var(--fs-body)',
            fontWeight: 600,
            cursor: isCacLoading ? 'not-allowed' : 'pointer',
          }}
        >
          {isCacLoading ? '조회 중...' : '조회'}
        </button>
      </div>

      {cacError && (
        <p role="alert" style={{ color: 'var(--color-error)', fontSize: 'var(--fs-body)' }}>
          {cacError}
        </p>
      )}

      {cacResult && (
        <div>
          <div style={{ display: 'flex', gap: 'var(--spacing-xl)', flexWrap: 'wrap', marginBottom: 'var(--spacing-sm)' }}>
            <div>
              <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-text-muted)' }}>기간 광고비 합계</p>
              <p style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--fs-h2)', fontWeight: 700, color: 'var(--color-primary)' }}>
                {cacResult.totalSpendKrw?.toLocaleString('ko-KR')}원
              </p>
            </div>
            <div>
              <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-text-muted)' }}>신규 결제자 수</p>
              <p style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--fs-h2)', fontWeight: 700, color: 'var(--color-primary)' }}>
                {cacResult.newPayingUsers?.toLocaleString('ko-KR')}명
              </p>
            </div>
            <div>
              <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-text-muted)' }}>CAC (블렌디드)</p>
              <p style={{ fontFamily: 'var(--font-serif)', fontSize: 'var(--fs-h2)', fontWeight: 700, color: 'var(--color-primary)' }}>
                {cacResult.cacKrw != null ? `${cacResult.cacKrw.toLocaleString('ko-KR')}원` : '산출 불가(신규 결제자 0명)'}
              </p>
            </div>
          </div>
          <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-text-muted)' }}>
            {cacResult.note}
          </p>
        </div>
      )}
    </div>
  )
}

export default function AdminAdSpendPage() {
  const {
    items, total, page, setPage, isLoading, error,
    recentChannels,
    form, updateField, editingId, startEdit, cancelEdit, submitForm, isSaving, formError,
    removeItem,
    cacRange, updateCacRange, cacResult, isCacLoading, cacError, fetchCac,
  } = useAdminAdSpend()

  const LIMIT = 20
  const totalPages = Math.ceil(total / LIMIT) || 1

  return (
    <div className="admin-page">
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: 'var(--fs-h2)', fontWeight: 800, color: 'var(--color-primary)', letterSpacing: 'var(--ls-heading-ko)' }}>
          광고비 / CAC
        </h1>
        <p style={{ fontSize: 'var(--fs-caption)', color: 'var(--color-text-muted)', marginTop: 4 }}>
          채널별 광고 집행 금액을 입력하고, 고객획득비용(CAC)을 조회합니다.
        </p>
      </div>

      <AdSpendForm
        form={form}
        updateField={updateField}
        recentChannels={recentChannels}
        editingId={editingId}
        cancelEdit={cancelEdit}
        submitForm={submitForm}
        isSaving={isSaving}
        formError={formError}
      />

      <CacPanel
        cacRange={cacRange}
        updateCacRange={updateCacRange}
        cacResult={cacResult}
        isCacLoading={isCacLoading}
        cacError={cacError}
        fetchCac={fetchCac}
      />

      {error && (
        <p role="alert" style={{ color: 'var(--color-error)', marginBottom: 'var(--spacing-md)', fontSize: 'var(--fs-body)' }}>
          {error}
        </p>
      )}

      <div className="admin-table-wrapper">
        <table
          style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--fs-body)', background: 'var(--color-surface)' }}
          aria-label="광고비 목록"
          aria-busy={isLoading}
        >
          <thead>
            <tr style={{ background: 'var(--color-surface-warm)' }}>
              {['채널', '기간', '광고비', '메모', '액션'].map((th) => (
                <th key={th} scope="col" style={thStyle}>{th}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--spacing-2xl)' }}>
                  불러오는 중...
                </td>
              </tr>
            )}
            {!isLoading && items.length === 0 && (
              <tr>
                <td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--color-text-muted)', padding: 'var(--spacing-2xl)' }}>
                  등록된 광고비가 없습니다.
                </td>
              </tr>
            )}
            {!isLoading && items.map((item) => (
              <tr key={item.adSpendId} style={{ background: 'var(--color-surface)' }}>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{item.channel}</td>
                <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontSize: 'var(--fs-caption)', color: 'var(--color-text-secondary)' }}>
                  {String(item.periodStart).slice(0, 10)} ~ {String(item.periodEnd).slice(0, 10)}
                </td>
                <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontWeight: 600 }}>
                  {item.spendKrw?.toLocaleString('ko-KR')}원
                </td>
                <td style={{ ...tdStyle, color: 'var(--color-text-secondary)' }}>{item.note || '-'}</td>
                <td style={tdStyle}>
                  <div style={{ display: 'flex', gap: 'var(--spacing-xs)' }}>
                    <button
                      type="button"
                      onClick={() => startEdit(item)}
                      aria-label={`${item.channel} 수정`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 'var(--min-touch-target)', height: 'var(--min-touch-target)',
                        background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
                        color: 'var(--color-primary)', cursor: 'pointer',
                      }}
                    >
                      <Pencil size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => { if (window.confirm('이 광고비 내역을 삭제할까요?')) removeItem(item.adSpendId) }}
                      aria-label={`${item.channel} 삭제`}
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 'var(--min-touch-target)', height: 'var(--min-touch-target)',
                        background: 'none', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
                        color: 'var(--color-error)', cursor: 'pointer',
                      }}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="admin-pagination" aria-label="페이지 탐색">
          <button
            onClick={() => setPage(page - 1)}
            disabled={page <= 1 || isLoading}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 40, height: 40, minHeight: 'var(--min-touch-target)',
              background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
              cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.4 : 1,
            }}
            aria-label="이전 페이지"
          >
            이전
          </button>
          <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--color-primary)' }}>
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page >= totalPages || isLoading}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 40, height: 40, minHeight: 'var(--min-touch-target)',
              background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
              cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.4 : 1,
            }}
            aria-label="다음 페이지"
          >
            다음
          </button>
        </div>
      )}
    </div>
  )
}
