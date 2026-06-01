'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  loadNoteCategories,
  upsertNoteCategory,
  deleteNoteCategory,
  deleteNoteBody,
} from '@/lib/db'

type Card = { id: number; text: string }

type Category = {
  key: string
  name: string
  emoji: string
  bg: string
  header: string
  cardBg: string
  btn: string
  ring: string
  cards: Card[]
  colorIndex: number
}

const COLOR_PALETTE = [
  { bg: 'bg-sky-50',     header: 'bg-sky-200',     cardBg: 'bg-white/70', btn: 'bg-sky-200 hover:bg-sky-300',     ring: 'ring-sky-200'     },
  { bg: 'bg-emerald-50', header: 'bg-emerald-200', cardBg: 'bg-white/70', btn: 'bg-emerald-200 hover:bg-emerald-300', ring: 'ring-emerald-200' },
  { bg: 'bg-amber-50',   header: 'bg-amber-200',   cardBg: 'bg-white/70', btn: 'bg-amber-200 hover:bg-amber-300', ring: 'ring-amber-200'   },
  { bg: 'bg-violet-50',  header: 'bg-violet-200',  cardBg: 'bg-white/70', btn: 'bg-violet-200 hover:bg-violet-300', ring: 'ring-violet-200'  },
  { bg: 'bg-rose-50',    header: 'bg-rose-200',    cardBg: 'bg-white/70', btn: 'bg-rose-200 hover:bg-rose-300',   ring: 'ring-rose-200'    },
  { bg: 'bg-orange-50',  header: 'bg-orange-200',  cardBg: 'bg-white/70', btn: 'bg-orange-200 hover:bg-orange-300', ring: 'ring-orange-200'  },
  { bg: 'bg-pink-50',    header: 'bg-pink-200',    cardBg: 'bg-white/70', btn: 'bg-pink-200 hover:bg-pink-300',   ring: 'ring-pink-200'    },
]

const EMOJIS = ['🎯', '🏃', '🌱', '✦', '📋', '💡', '🎨', '📚', '💪', '🌟']

const INITIAL: Category[] = [
  { key: 'career',   name: '진로', emoji: '🎯', ...COLOR_PALETTE[0], colorIndex: 0, cards: [] },
  { key: 'activity', name: '활동', emoji: '🏃', ...COLOR_PALETTE[1], colorIndex: 1, cards: [] },
  { key: 'growth',   name: '성장', emoji: '🌱', ...COLOR_PALETTE[2], colorIndex: 2, cards: [] },
]

const STORAGE_KEY = 'dam-notes'

function saveLocal(cats: Category[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cats)) } catch {}
}

export default function NotesBoard() {
  const [categories, setCategories] = useState<Category[]>(INITIAL)
  const [addingKey, setAddingKey] = useState<string | null>(null)
  const [draftText, setDraftText] = useState('')
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
  const [deletingKey, setDeletingKey] = useState<string | null>(null)

  const toggleExpand = (key: string) =>
    setExpandedCards(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  const getPreview = (text: string) =>
    text.split('\n').find(l => l.trim()) ?? text

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const newCatInputRef = useRef<HTMLInputElement>(null)

  // 로드: Supabase 우선, 없으면 localStorage
  useEffect(() => {
    loadNoteCategories().then(data => {
      if (data && data.length > 0) {
        // Supabase 데이터로 복원
        const localRaw = localStorage.getItem(STORAGE_KEY)
        const localCats = localRaw ? JSON.parse(localRaw) as Category[] : []

        
        const merged = data.map(row => {
          const palette = COLOR_PALETTE[row.color_index % COLOR_PALETTE.length]
          return {
            key: row.key,
            name: row.name,
            emoji: row.emoji,
            colorIndex: row.color_index,
            ...palette,
            cards: row.cards ?? [],
          }
        })

        setCategories(merged)
        saveLocal(merged)
      } else {
        // localStorage 폴백
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          try {
            const data = JSON.parse(raw)
            if (Array.isArray(data)) setCategories(data)
          } catch {}
        }
      }
    })
  }, [])

  useEffect(() => { if (addingKey) textareaRef.current?.focus() }, [addingKey])
  useEffect(() => { if (editingKey) titleInputRef.current?.focus() }, [editingKey])
  useEffect(() => { if (addingCategory) newCatInputRef.current?.focus() }, [addingCategory])

  const syncCategories = (cats: Category[]) => {
  setCategories(cats)
  saveLocal(cats)
  cats.forEach((cat, i) => {
    upsertNoteCategory({
      key: cat.key,
      name: cat.name,
      emoji: cat.emoji,
      color_index: cat.colorIndex,
      sort_order: i,
      cards: cat.cards,
    })
  })
}

  /* ---- 카드 추가 ---- */
  const startAdding = (key: string) => { setAddingKey(key); setDraftText('') }

  const confirmAdd = (key: string) => {
    const text = draftText.trim()
    if (!text) { setAddingKey(null); return }
    const next = categories.map(cat =>
      cat.key === key
        ? { ...cat, cards: [...cat.cards, { id: Date.now(), text }] }
        : cat
    )
    syncCategories(next)
    setAddingKey(null)
    setDraftText('')
  }

  /* ---- 보드 삭제 ---- */
  const confirmDeleteCategory = (key: string) => {
    const cat = categories.find(c => c.key === key)
    if (cat) {
      cat.cards.forEach(card => deleteNoteBody(card.id.toString()))
    }
    deleteNoteCategory(key)
    const next = categories.filter(cat => cat.key !== key)
    syncCategories(next)
    setDeletingKey(null)
  }

  /* ---- 카드 삭제 ---- */
  const deleteCard = (catKey: string, cardId: number) => {
    deleteNoteBody(cardId.toString())
    const next = categories.map(cat =>
      cat.key === catKey ? { ...cat, cards: cat.cards.filter(c => c.id !== cardId) } : cat
    )
    syncCategories(next)
  }

  /* ---- 제목 수정 ---- */
  const startRename = (key: string, name: string) => { setEditingKey(key); setEditingName(name) }

  const confirmRename = (key: string) => {
    const name = editingName.trim()
    if (name) {
      const next = categories.map(cat => cat.key === key ? { ...cat, name } : cat)
      syncCategories(next)
    }
    setEditingKey(null)
  }

  /* ---- 새 노트 보드 추가 ---- */
  const confirmAddCategory = () => {
    const name = newCatName.trim()
    if (!name) { setAddingCategory(false); return }
    const colorIdx = categories.length % COLOR_PALETTE.length
    const emojiIdx = categories.length % EMOJIS.length
    const newCat: Category = {
      key: `cat-${Date.now()}`,
      name,
      emoji: EMOJIS[emojiIdx],
      colorIndex: colorIdx,
      ...COLOR_PALETTE[colorIdx],
      cards: [],
    }
    const next = [...categories, newCat]
    syncCategories(next)
    setAddingCategory(false)
    setNewCatName('')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-purple-50 to-sky-50 px-4 py-10">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-slate-600 tracking-wide">노트</h1>
        <p className="mt-1 text-sm text-slate-400">카테고리별로 생각을 기록해보세요</p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl mx-auto">
        {categories.map(cat => (
          <div
            key={cat.key}
            className={`flex flex-col rounded-2xl overflow-hidden ring-1 ${cat.ring} shadow-sm ${cat.bg}`}
          >
            {/* 헤더 */}
            <div className={`group/header ${cat.header} px-4 py-3 flex items-center justify-between`}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-lg flex-shrink-0">{cat.emoji}</span>
                {editingKey === cat.key ? (
                  <input
                    ref={titleInputRef}
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') confirmRename(cat.key)
                      if (e.key === 'Escape') setEditingKey(null)
                    }}
                    onBlur={() => confirmRename(cat.key)}
                    className="font-semibold text-slate-700 text-sm bg-transparent outline-none border-b border-slate-600/40 w-28 min-w-0"
                  />
                ) : (
                  <button
                    onClick={() => startRename(cat.key, cat.name)}
                    className="font-semibold text-slate-700 text-sm hover:underline text-left truncate"
                  >
                    {cat.name}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                <span className="text-xs bg-white/60 text-slate-500 rounded-full px-2 py-0.5">
                  {cat.cards.length}
                </span>
                {deletingKey === cat.key ? (
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-slate-600">삭제할까요?</span>
                    <button onClick={() => confirmDeleteCategory(cat.key)}
                      className="text-[11px] font-semibold bg-rose-500 text-white rounded-md px-2 py-0.5 hover:bg-rose-600 transition-colors">
                      삭제
                    </button>
                    <button onClick={() => setDeletingKey(null)}
                      className="text-[11px] text-slate-500 bg-white/60 rounded-md px-2 py-0.5 hover:bg-white/90 transition-colors">
                      취소
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setDeletingKey(cat.key)}
                    className="opacity-0 group-hover/header:opacity-100 text-slate-400 hover:text-rose-500 transition-all">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                      className="w-3.5 h-3.5">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* 카드 목록 */}
            <div className="flex-1 px-3 py-3 space-y-2 min-h-[120px]">
              {cat.cards.map(card => {
                const expandKey = `${cat.key}-${card.id}`
                const isExpanded = expandedCards.has(expandKey)
                return (
                  <div key={card.id} className="group flex items-start gap-2">
                    <button
                      onClick={() => toggleExpand(expandKey)}
                      className={`flex-shrink-0 mt-0.5 w-6 h-6 flex items-center justify-center rounded-lg transition-all
                        ${isExpanded ? `${cat.header} text-slate-600` : 'bg-white/50 text-slate-400 hover:bg-white/80'}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
                        className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                    <div className={`flex-1 min-w-0 ${cat.cardBg} rounded-xl shadow-sm ring-1 ring-black/5`}>
                      <div className="flex items-center gap-2 px-3 py-2.5">
                        <Link href={`/notes/${card.id}`}
                          className="flex-1 text-sm text-slate-700 truncate leading-snug hover:underline">
                          {getPreview(card.text)}
                        </Link>
                        <button
                          onClick={e => { e.stopPropagation(); deleteCard(cat.key, card.id) }}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 text-lg leading-none transition-all flex-shrink-0">
                          ×
                        </button>
                      </div>
                      {isExpanded && (
                        <div className="px-3 pb-3 pt-0.5 border-t border-black/5">
                          <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                            {card.text}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {addingKey === cat.key && (
                <div className={`${cat.cardBg} rounded-xl px-3 py-2.5 ring-1 ring-black/10 shadow-sm`}>
                  <textarea
                    ref={textareaRef}
                    value={draftText}
                    onChange={e => setDraftText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); confirmAdd(cat.key) }
                      if (e.key === 'Escape') setAddingKey(null)
                    }}
                    placeholder="내용을 입력하세요..."
                    rows={3}
                    className="w-full text-sm text-slate-700 placeholder:text-slate-400 bg-transparent outline-none resize-none leading-relaxed"
                  />
                  <div className="flex justify-end gap-1.5 mt-1.5">
                    <button onClick={() => setAddingKey(null)}
                      className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 rounded-lg transition-colors">
                      취소
                    </button>
                    <button onClick={() => confirmAdd(cat.key)}
                      className={`text-xs font-medium text-slate-700 px-3 py-1 rounded-lg transition-colors ${cat.btn}`}>
                      추가
                    </button>
                  </div>
                </div>
              )}
            </div>

            {addingKey !== cat.key && (
              <div className="px-3 pb-3">
                <button onClick={() => startAdding(cat.key)}
                  className={`w-full flex items-center justify-center gap-1.5 text-sm text-slate-600 font-medium py-2 rounded-xl transition-colors ${cat.btn}`}>
                  <span className="text-base leading-none">+</span>
                  카드 추가
                </button>
              </div>
            )}
          </div>
        ))}

        {addingCategory ? (
          <div className="flex flex-col justify-center rounded-2xl ring-1 ring-black/10 bg-white/50 shadow-sm p-5 gap-3">
            <p className="text-sm font-medium text-slate-600">새 노트 보드</p>
            <input
              ref={newCatInputRef}
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') confirmAddCategory()
                if (e.key === 'Escape') { setAddingCategory(false); setNewCatName('') }
              }}
              placeholder="보드 이름 입력..."
              className="text-sm text-slate-700 bg-white/80 outline-none border border-slate-200 rounded-lg px-3 py-1.5 focus:border-slate-400 transition-colors"
            />
            <div className="flex gap-2">
              <button onClick={() => { setAddingCategory(false); setNewCatName('') }}
                className="flex-1 text-sm text-slate-500 py-1.5 rounded-xl hover:bg-black/5 transition-colors">
                취소
              </button>
              <button onClick={confirmAddCategory}
                className="flex-1 text-sm font-medium text-slate-700 py-1.5 rounded-xl bg-violet-200 hover:bg-violet-300 transition-colors">
                만들기
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAddingCategory(true)}
            className="flex items-center justify-center gap-2 h-28 rounded-2xl border-2 border-dashed border-slate-300 text-slate-400 hover:border-violet-300 hover:text-violet-400 transition-colors text-sm font-medium">
            <span className="text-xl leading-none">+</span>
            새 노트 보드
          </button>
        )}
      </div>
    </div>
  )
}