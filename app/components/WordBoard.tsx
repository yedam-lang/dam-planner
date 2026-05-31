'use client'

import { useState, useEffect, useRef } from 'react'

// ── 타입 ──────────────────────────────────────────────
type VerseCard = { id: number; verse: string; ref: string }
type Entry     = { id: number; date: string; ref: string; verse: string; reflection: string }

// ── 저장 키 ───────────────────────────────────────────
const CARDS_KEY   = 'dam-word-cards'
const ENTRIES_KEY = 'dam-word-entries'

// ── 카드 배경 (순환) ──────────────────────────────────
const CARD_BG = [
  'bg-gradient-to-br from-violet-100 to-purple-50',
  'bg-gradient-to-br from-sky-100 to-blue-50',
  'bg-gradient-to-br from-rose-100 to-pink-50',
  'bg-gradient-to-br from-amber-100 to-yellow-50',
  'bg-gradient-to-br from-emerald-100 to-green-50',
]

// ── 유틸 ──────────────────────────────────────────────
function today() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function formatDate(s: string) {
  const [y,m,d] = s.split('-').map(Number)
  return `${y}년 ${m}월 ${d}일`
}
function saveCards(data: VerseCard[])   { try { localStorage.setItem(CARDS_KEY,   JSON.stringify(data)) } catch {} }
function saveEntries(data: Entry[])     { try { localStorage.setItem(ENTRIES_KEY, JSON.stringify(data)) } catch {} }

export default function WordBoard() {
  const [cards,   setCards]   = useState<VerseCard[]>([])
  const [entries, setEntries] = useState<Entry[]>([])

  // 말씀 카드 추가 폼
  const [addingCard,  setAddingCard]  = useState(false)
  const [cardVerse,   setCardVerse]   = useState('')
  const [cardRef,     setCardRef]     = useState('')
  const cardVerseRef = useRef<HTMLTextAreaElement>(null)

  // 묵상 기록 추가 폼
  const [addingEntry, setAddingEntry] = useState(false)
  const [form, setForm] = useState({ date: today(), ref: '', verse: '', reflection: '' })
  const entryRefInput = useRef<HTMLInputElement>(null)

  // 묵상 펼치기
  const [expandedId, setExpandedId] = useState<number | null>(null)

  useEffect(() => {
    try {
      const rc = localStorage.getItem(CARDS_KEY);   if (rc) setCards(JSON.parse(rc))
      const re = localStorage.getItem(ENTRIES_KEY); if (re) setEntries(JSON.parse(re))
    } catch {}
  }, [])

  useEffect(() => { if (addingCard)  cardVerseRef.current?.focus() },  [addingCard])
  useEffect(() => { if (addingEntry) entryRefInput.current?.focus() }, [addingEntry])

  // ── 말씀 카드 ─────────────────────────────────────
  const confirmCard = () => {
    if (!cardVerse.trim()) { setAddingCard(false); return }
    const next = [{ id: Date.now(), verse: cardVerse.trim(), ref: cardRef.trim() }, ...cards]
    setCards(next); saveCards(next)
    setCardVerse(''); setCardRef(''); setAddingCard(false)
  }

  const deleteCard = (id: number) => {
    const next = cards.filter(c => c.id !== id); setCards(next); saveCards(next)
  }

  // ── 묵상 기록 ────────────────────────────────────
  const confirmEntry = () => {
    if (!form.verse.trim() && !form.ref.trim()) { setAddingEntry(false); return }
    const next = [{ id: Date.now(), ...form }, ...entries]
    setEntries(next); saveEntries(next)
    setForm({ date: today(), ref: '', verse: '', reflection: '' }); setAddingEntry(false)
  }

  const deleteEntry = (id: number) => {
    const next = entries.filter(e => e.id !== id); setEntries(next); saveEntries(next)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-sky-50 px-4 py-10">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-slate-600 tracking-wide">말씀</h1>
        <p className="mt-1 text-sm text-slate-400">말씀을 붙들고 묵상을 기록해보세요</p>
      </header>

      <div className="max-w-xl mx-auto space-y-10">

        {/* ══ 말씀 카드 섹션 ══════════════════════════ */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">말씀 카드</h2>
            {!addingCard && (
              <button
                onClick={() => setAddingCard(true)}
                className="text-xs font-medium text-violet-500 hover:text-violet-700 bg-violet-100 hover:bg-violet-200 px-3 py-1.5 rounded-full transition-colors"
              >
                + 말씀 추가
              </button>
            )}
          </div>

          {/* 카드 추가 폼 */}
          {addingCard && (
            <div className="mb-4 bg-white/70 rounded-2xl ring-1 ring-violet-200 shadow-sm p-5 space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                  말씀 본문
                </label>
                <textarea
                  ref={cardVerseRef}
                  value={cardVerse}
                  onChange={e => setCardVerse(e.target.value)}
                  placeholder="말씀 본문을 입력하세요..."
                  rows={4}
                  className="mt-1 w-full text-sm text-slate-700 bg-slate-50 rounded-xl px-4 py-3 outline-none ring-1 ring-black/10 focus:ring-violet-300 transition-colors placeholder:text-slate-400 resize-none leading-relaxed"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
                  출처
                </label>
                <input
                  type="text"
                  value={cardRef}
                  onChange={e => setCardRef(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && confirmCard()}
                  placeholder="예) 잠언 24장 33-34절"
                  className="mt-1 w-full text-sm text-slate-700 bg-slate-50 rounded-xl px-4 py-2 outline-none ring-1 ring-black/10 focus:ring-violet-300 transition-colors placeholder:text-slate-400"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setAddingCard(false); setCardVerse(''); setCardRef('') }}
                  className="flex-1 py-2 rounded-xl text-sm text-slate-500 hover:bg-black/5 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={confirmCard}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold text-slate-700 bg-violet-200 hover:bg-violet-300 transition-colors"
                >
                  저장
                </button>
              </div>
            </div>
          )}

          {/* 카드 목록 */}
          <div className="space-y-4">
            {cards.map((card, idx) => (
              <div
                key={card.id}
                className={`group relative rounded-2xl shadow-sm ring-1 ring-black/5 px-6 py-7 ${CARD_BG[idx % CARD_BG.length]}`}
              >
                {/* 삭제 버튼 */}
                <button
                  onClick={() => deleteCard(card.id)}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition-all p-1 rounded-lg hover:bg-white/60"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                    className="w-4 h-4">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </button>

                {/* 말씀 본문 */}
                <p className="text-lg font-medium text-slate-700 leading-8 whitespace-pre-wrap">
                  {card.verse}
                </p>

                {/* 출처 */}
                {card.ref && (
                  <p className="mt-4 text-sm font-semibold text-slate-500 text-right">
                    — {card.ref}
                  </p>
                )}
              </div>
            ))}

            {cards.length === 0 && !addingCard && (
              <p className="text-center text-sm text-slate-400 py-8">
                붙들고 싶은 말씀을 카드로 저장해보세요
              </p>
            )}
          </div>
        </section>

        {/* ══ 묵상 기록 섹션 ══════════════════════════ */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">묵상 기록</h2>
            {!addingEntry && (
              <button
                onClick={() => setAddingEntry(true)}
                className="text-xs font-medium text-violet-500 hover:text-violet-700 bg-violet-100 hover:bg-violet-200 px-3 py-1.5 rounded-full transition-colors"
              >
                + 기록 추가
              </button>
            )}
          </div>

          {addingEntry && (
            <div className="mb-4 bg-white/70 rounded-2xl ring-1 ring-violet-200 shadow-sm p-5 space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">날짜</label>
                  <input type="date" value={form.date}
                    onChange={e => setForm(p => ({...p, date: e.target.value}))}
                    className="mt-1 w-full text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-1.5 outline-none ring-1 ring-black/10 focus:ring-violet-300 transition-colors"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">성경 구절</label>
                  <input ref={entryRefInput} type="text" value={form.ref}
                    onChange={e => setForm(p => ({...p, ref: e.target.value}))}
                    placeholder="예) 요 3:16"
                    className="mt-1 w-full text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-1.5 outline-none ring-1 ring-black/10 focus:ring-violet-300 transition-colors placeholder:text-slate-400"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">본문</label>
                <textarea value={form.verse} onChange={e => setForm(p => ({...p, verse: e.target.value}))}
                  placeholder="말씀 본문..." rows={2}
                  className="mt-1 w-full text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2 outline-none ring-1 ring-black/10 focus:ring-violet-300 transition-colors placeholder:text-slate-400 resize-none leading-relaxed"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">묵상</label>
                <textarea value={form.reflection} onChange={e => setForm(p => ({...p, reflection: e.target.value}))}
                  placeholder="오늘의 묵상..." rows={3}
                  className="mt-1 w-full text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2 outline-none ring-1 ring-black/10 focus:ring-violet-300 transition-colors placeholder:text-slate-400 resize-none leading-relaxed"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={() => setAddingEntry(false)}
                  className="flex-1 py-2 rounded-xl text-sm text-slate-500 hover:bg-black/5 transition-colors">
                  취소
                </button>
                <button onClick={confirmEntry}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold text-slate-700 bg-violet-200 hover:bg-violet-300 transition-colors">
                  저장
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {entries.map(entry => {
              const isExpanded = expandedId === entry.id
              return (
                <div key={entry.id} className="group bg-white/60 rounded-2xl ring-1 ring-violet-100 shadow-sm overflow-hidden">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                    className="w-full flex items-center gap-3 px-5 py-4 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {entry.ref && (
                          <span className="text-xs font-semibold bg-violet-100 text-violet-600 rounded-full px-2.5 py-0.5 flex-shrink-0">
                            {entry.ref}
                          </span>
                        )}
                        <span className="text-xs text-slate-400">{formatDate(entry.date)}</span>
                      </div>
                      {!isExpanded && entry.verse && (
                        <p className="mt-1 text-sm text-slate-600 truncate leading-snug">{entry.verse}</p>
                      )}
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                      className={`w-4 h-4 text-slate-400 flex-shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {isExpanded && (
                    <div className="px-5 pb-5 space-y-3 border-t border-black/5">
                      {entry.verse && (
                        <div className="pt-4">
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">본문</p>
                          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-violet-50 rounded-xl px-4 py-3">
                            {entry.verse}
                          </p>
                        </div>
                      )}
                      {entry.reflection && (
                        <div>
                          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest mb-1.5">묵상</p>
                          <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">{entry.reflection}</p>
                        </div>
                      )}
                      <div className="flex justify-end pt-1">
                        <button onClick={() => deleteEntry(entry.id)}
                          className="text-xs text-slate-400 hover:text-rose-500 transition-colors px-2 py-1 rounded-lg hover:bg-rose-50">
                          삭제
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            {entries.length === 0 && !addingEntry && (
              <p className="text-center text-sm text-slate-400 py-6">아직 기록된 묵상이 없어요</p>
            )}
          </div>
        </section>

      </div>
    </div>
  )
}
