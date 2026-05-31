'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

type CalEvent = { id: number; title: string; color: string }
type EventMap  = Record<string, CalEvent[]>

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const COLORS = [
  { key: 'rose',    chip: 'bg-rose-200 text-rose-700',       dot: 'bg-rose-400'    },
  { key: 'sky',     chip: 'bg-sky-200 text-sky-700',         dot: 'bg-sky-400'     },
  { key: 'amber',   chip: 'bg-amber-200 text-amber-700',     dot: 'bg-amber-400'   },
  { key: 'emerald', chip: 'bg-emerald-200 text-emerald-700', dot: 'bg-emerald-400' },
  { key: 'violet',  chip: 'bg-violet-200 text-violet-700',   dot: 'bg-violet-400'  },
]

// ── 유틸 ──────────────────────────────────────────────
function dk(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function getCalDays(y: number, m: number): (number | null)[] {
  const start = new Date(y, m, 1).getDay()
  const total = new Date(y, m + 1, 0).getDate()
  const days: (number | null)[] = Array(start).fill(null)
  for (let d = 1; d <= total; d++) days.push(d)
  while (days.length % 7) days.push(null)
  return days
}

function sorted(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a]
}

function datesInRange(a: string, b: string): string[] {
  const [s, e] = sorted(a, b)
  const result: string[] = []
  const cur = new Date(s + 'T12:00:00')
  const end = new Date(e + 'T12:00:00')
  while (cur <= end) {
    result.push(dk(cur.getFullYear(), cur.getMonth(), cur.getDate()))
    cur.setDate(cur.getDate() + 1)
  }
  return result
}

function fmtDate(s: string) {
  const [, m, d] = s.split('-').map(Number)
  return `${m}월 ${d}일`
}

function fmtRange(s: string, e: string) {
  if (s === e) return fmtDate(s)
  const n = datesInRange(s, e).length
  return `${fmtDate(s)} – ${fmtDate(e)}  (${n}일)`
}

export default function CalendarView() {
  const today = new Date()
  const [viewYear,  setViewYear]  = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [events,    setEvents]    = useState<EventMap>({})
  const [nextId,    setNextId]    = useState(0)

  // 선택 범위
  const [selStart, setSelStart] = useState<string | null>(null)
  const [selEnd,   setSelEnd]   = useState<string | null>(null)
  const dragging = useRef(false)

  // 입력
  const [inputText,     setInputText]     = useState('')
  const [selectedColor, setSelectedColor] = useState('rose')
  const inputRef = useRef<HTMLInputElement>(null)
  const gridRef  = useRef<HTMLDivElement>(null)

  // localStorage 로드
  useEffect(() => {
    try {
      const raw = localStorage.getItem('dam-calendar-events')
      if (raw) {
        const data = JSON.parse(raw)
        setEvents(data.events ?? {})
        setNextId(data.nextId ?? 0)
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (selStart) setTimeout(() => inputRef.current?.focus(), 60)
  }, [selStart])

  const save = (next: EventMap, nid: number) => {
    try { localStorage.setItem('dam-calendar-events', JSON.stringify({ events: next, nextId: nid })) } catch {}
  }

  // ── 월 이동 ──────────────────────────────────────────
  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  // ── 범위 계산 ────────────────────────────────────────
  const [rs, re] = (selStart && selEnd) ? sorted(selStart, selEnd)
    : selStart ? [selStart, selStart]
    : ['', '']
  const rangeDates = rs ? datesInRange(rs, re) : []

  // ── 드래그 핸들러 ─────────────────────────────────────
  const startDrag = (key: string) => {
    dragging.current = true
    setSelStart(key)
    setSelEnd(key)
  }

  const extendDrag = (key: string) => {
    if (!dragging.current) return
    setSelEnd(key)
  }

  const endDrag = () => { dragging.current = false }

  // 터치 이동 — elementFromPoint로 어느 셀인지 감지
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!dragging.current) return
    e.preventDefault()
    const t = e.touches[0]
    const el = document.elementFromPoint(t.clientX, t.clientY)
    const date = el?.closest('[data-date]')?.getAttribute('data-date')
    if (date) setSelEnd(date)
  }, [])

  useEffect(() => {
    const g = gridRef.current
    if (!g) return
    g.addEventListener('touchmove', handleTouchMove, { passive: false })
    return () => g.removeEventListener('touchmove', handleTouchMove)
  }, [handleTouchMove])

  // ── 일정 CRUD ────────────────────────────────────────
  const addEvent = () => {
    const title = inputText.trim()
    if (!title || !rs) return
    let next = { ...events }
    let id = nextId
    for (const d of rangeDates) {
      next = { ...next, [d]: [...(next[d] ?? []), { id: id++, title, color: selectedColor }] }
    }
    setEvents(next)
    setNextId(id)
    save(next, id)
    setInputText('')
  }

  const deleteEvent = (key: string, id: number) => {
    const next = { ...events, [key]: (events[key] ?? []).filter(e => e.id !== id) }
    setEvents(next)
    save(next, nextId)
  }

  // ── 패널 닫기 ────────────────────────────────────────
  const closePanel = () => { setSelStart(null); setSelEnd(null); setInputText('') }

  // 현재 뷰에서 오늘 여부
  const isToday = (d: number) =>
    d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear()

  const calDays = getCalDays(viewYear, viewMonth)

  // 패널에 표시할 기존 이벤트
  const panelEvents = rangeDates.flatMap(d =>
    (events[d] ?? []).map(ev => ({ ...ev, dateKey: d }))
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-purple-50 to-sky-50 px-4 py-10">
      <header className="mb-6 text-center">
        <h1 className="text-3xl font-bold text-slate-600 tracking-wide">캘린더</h1>
        <p className="mt-1 text-sm text-slate-400">날짜를 클릭하거나 드래그해서 연속 일정을 추가하세요</p>
      </header>

      <div className="max-w-2xl mx-auto">
        {/* 월 네비게이션 */}
        <div className="flex items-center justify-between mb-4 px-1">
          <button onClick={prevMonth}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/60 hover:bg-white/90 text-slate-500 shadow-sm transition-colors">‹</button>
          <span className="font-semibold text-slate-600 text-lg">{viewYear}년 {viewMonth + 1}월</span>
          <button onClick={nextMonth}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/60 hover:bg-white/90 text-slate-500 shadow-sm transition-colors">›</button>
        </div>

        {/* 캘린더 */}
        <div
          className="bg-white/60 rounded-2xl shadow-sm ring-1 ring-black/5 overflow-hidden"
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
        >
          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 border-b border-black/5">
            {WEEKDAYS.map((d, i) => (
              <div key={d} className={`py-2 text-center text-xs font-semibold
                ${i === 0 ? 'text-rose-400' : i === 6 ? 'text-sky-400' : 'text-slate-500'}`}>
                {d}
              </div>
            ))}
          </div>

          {/* 날짜 셀 */}
          <div className="grid grid-cols-7" ref={gridRef} onTouchEnd={endDrag}>
            {calDays.map((day, idx) => {
              const key  = day ? dk(viewYear, viewMonth, day) : null
              const dayEvents = key ? (events[key] ?? []) : []
              const isStart   = key === rs && rs !== ''
              const isEnd     = key === re && re !== '' && rs !== re
              const inSel     = key ? (key >= rs && key <= re && rs !== '') : false
              const dow = idx % 7

              return (
                <div
                  key={idx}
                  data-date={key ?? undefined}
                  onMouseDown={() => key && startDrag(key)}
                  onMouseEnter={() => key && extendDrag(key)}
                  onTouchStart={() => key && startDrag(key)}
                  className={[
                    'min-h-[72px] p-1.5 border-b border-r border-black/5 last:border-r-0 select-none transition-colors',
                    day ? 'cursor-pointer' : '',
                    isStart || isEnd  ? 'bg-violet-200/70' : '',
                    inSel && !isStart && !isEnd ? 'bg-violet-100/60' : '',
                    !inSel && day ? 'hover:bg-violet-50/50' : '',
                  ].filter(Boolean).join(' ')}
                >
                  {day && (
                    <>
                      <span className={[
                        'inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-medium mb-1',
                        isToday(day) ? 'bg-violet-400 text-white' : '',
                        !isToday(day) && dow === 0 ? 'text-rose-400' : '',
                        !isToday(day) && dow === 6 ? 'text-sky-400' : '',
                        !isToday(day) && dow > 0 && dow < 6 ? 'text-slate-600' : '',
                      ].join(' ')}>
                        {day}
                      </span>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 2).map(ev => {
                          const c = COLORS.find(c => c.key === ev.color) ?? COLORS[0]
                          return (
                            <div key={ev.id}
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md truncate leading-tight ${c.chip}`}>
                              {ev.title}
                            </div>
                          )
                        })}
                        {dayEvents.length > 2 && (
                          <div className="text-[10px] text-slate-400 px-1">+{dayEvents.length - 2}개</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 패널 */}
        {rs && (
          <div className="mt-4 bg-white/70 rounded-2xl shadow-sm ring-1 ring-black/5 overflow-hidden">
            {/* 헤더 */}
            <div className="flex items-center justify-between px-4 py-3 bg-violet-100">
              <span className="font-semibold text-slate-700">{fmtRange(rs, re)}</span>
              <button onClick={closePanel}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>

            {/* 날짜 범위 조정 */}
            <div className="px-4 pt-3 flex items-end gap-2">
              <div className="flex-1">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">시작일</label>
                <input type="date" value={rs}
                  onChange={e => setSelStart(e.target.value)}
                  className="mt-1 w-full text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-1.5 outline-none ring-1 ring-black/10 focus:ring-violet-300 transition-colors"
                />
              </div>
              <span className="text-slate-300 pb-2 text-lg">–</span>
              <div className="flex-1">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">종료일</label>
                <input type="date" value={re} min={rs}
                  onChange={e => setSelEnd(e.target.value)}
                  className="mt-1 w-full text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-1.5 outline-none ring-1 ring-black/10 focus:ring-violet-300 transition-colors"
                />
              </div>
            </div>

            {/* 기존 일정 목록 */}
            <div className="px-4 py-3 space-y-2 min-h-[2rem]">
              {panelEvents.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-1">일정이 없습니다</p>
              )}
              {panelEvents.map(ev => {
                const c = COLORS.find(c => c.key === ev.color) ?? COLORS[0]
                const [, m, d] = ev.dateKey.split('-').map(Number)
                return (
                  <div key={`${ev.dateKey}-${ev.id}`} className="group flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
                    <span className="flex-1 text-sm text-slate-700">{ev.title}</span>
                    {rangeDates.length > 1 && (
                      <span className="text-[11px] text-slate-400">{m}/{d}</span>
                    )}
                    <button onClick={() => deleteEvent(ev.dateKey, ev.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 text-lg leading-none transition-opacity">
                      ×
                    </button>
                  </div>
                )
              })}
            </div>

            {/* 일정 추가 */}
            <div className="px-4 pb-4 space-y-2">
              <div className="flex gap-1.5">
                {COLORS.map(c => (
                  <button key={c.key} onClick={() => setSelectedColor(c.key)}
                    className={`w-6 h-6 rounded-full transition-transform ${c.dot}
                      ${selectedColor === c.key ? 'scale-125 ring-2 ring-offset-1 ring-slate-400' : 'opacity-60 hover:opacity-100'}`} />
                ))}
              </div>
              <div className="flex gap-2">
                <input ref={inputRef} type="text" value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addEvent()}
                  placeholder={rangeDates.length > 1 ? `${rangeDates.length}일 일정 이름...` : '일정 이름 입력...'}
                  className="flex-1 text-sm rounded-xl px-3 py-2 bg-white/80 placeholder:text-slate-400 text-slate-700 outline-none focus:bg-white ring-1 ring-black/10 transition-colors"
                />
                <button onClick={addEvent}
                  className="bg-violet-200 hover:bg-violet-300 text-slate-700 font-medium text-sm px-4 py-2 rounded-xl transition-colors">
                  추가
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
