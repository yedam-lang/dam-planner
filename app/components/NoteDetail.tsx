'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import NoteCanvas from './NoteCanvas'

type Props = { id: string }

function loadCardInfo(id: string): { catName: string; catEmoji: string; cardText: string } | null {
  try {
    const raw = localStorage.getItem('dam-notes')
    if (!raw) return null
    const cats = JSON.parse(raw) as Array<{
      name: string; emoji: string;
      cards: Array<{ id: number; text: string }>
    }>
    for (const cat of cats) {
      const card = cat.cards.find(c => c.id.toString() === id)
      if (card) return { catName: cat.name, catEmoji: cat.emoji, cardText: card.text }
    }
  } catch {}
  return null
}

function saveTitle(id: string, newTitle: string) {
  try {
    const raw = localStorage.getItem('dam-notes')
    if (!raw) return
    const cats = JSON.parse(raw) as Array<{
      name: string; emoji: string;
      cards: Array<{ id: number; text: string }>
    }>
    const updated = cats.map(cat => ({
      ...cat,
      cards: cat.cards.map(card =>
        card.id.toString() === id ? { ...card, text: newTitle } : card
      ),
    }))
    localStorage.setItem('dam-notes', JSON.stringify(updated))
  } catch {}
}

export default function NoteDetail({ id }: Props) {
  const BODY_KEY = `dam-note-body-${id}`

  const [catInfo, setCatInfo] = useState<{ catName: string; catEmoji: string } | null>(null)
  const [title, setTitle] = useState('')
  const [bodyText, setBodyText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const info = loadCardInfo(id)
    if (info) {
      setCatInfo({ catName: info.catName, catEmoji: info.catEmoji })
      setTitle(info.cardText)
    }
    setBodyText(localStorage.getItem(BODY_KEY) ?? '')
  }, [id, BODY_KEY])

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setTitle(val)
    saveTitle(id, val)
  }

  // textarea 자동 높이 조절
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [bodyText])

  const handleBodyChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value
    setBodyText(text)
    try { localStorage.setItem(BODY_KEY, text) } catch {}
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-purple-50 to-sky-50 px-4 py-8 pb-24">
      {/* 상단 네비게이션 */}
      <div className="max-w-2xl mx-auto mb-6 flex items-center gap-3">
        <Link
          href="/notes"
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
            className="w-4 h-4">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          뒤로
        </Link>
        {catInfo && (
          <span className="text-sm text-slate-400">
            {catInfo.catEmoji} {catInfo.catName}
          </span>
        )}
      </div>

      <div className="max-w-2xl mx-auto space-y-6">
        {/* 제목 */}
        <input
          value={title}
          onChange={handleTitleChange}
          placeholder="제목 없음"
          className="w-full text-xl font-bold text-slate-700 placeholder:text-slate-300 bg-transparent outline-none border-b-2 border-transparent focus:border-violet-300 transition-colors pb-1 leading-snug"
        />

        {/* 구분선 */}
        <div className="border-t border-slate-200" />

        {/* 텍스트 노트 영역 */}
        <section>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
            텍스트 노트
          </p>
          <div className="bg-white/70 rounded-2xl ring-1 ring-black/5 shadow-sm px-4 py-3">
            <textarea
              ref={textareaRef}
              value={bodyText}
              onChange={handleBodyChange}
              placeholder="여기에 내용을 자유롭게 작성하세요..."
              className="w-full text-sm text-slate-700 placeholder:text-slate-400 bg-transparent outline-none resize-none leading-relaxed min-h-[160px]"
            />
          </div>
        </section>

        {/* 구분선 */}
        <div className="border-t border-slate-200" />

        {/* 필기 캔버스 영역 */}
        <section>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
            필기 캔버스
          </p>
          <NoteCanvas noteId={id} />
        </section>
      </div>
    </div>
  )
}
