'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { loadCalendarEvents, saveCalendarEvent, deleteCalendarEvent } from '@/lib/db'

// ── 타입 ──────────────────────────────────────────────
export type RangeEvent = {
  id: number
  title: string
  color: string
  start: string   // YYYY-MM-DD
  end: string     // YYYY-MM-DD
}

type Bar = {
  event: RangeEvent
  startCol: number
  span: number
  lane: number
  isStart: boolean
  isEnd: boolean
}

type WeekRow = {
  days: (string | null)[]
  bars: Bar[]
  numLanes: number
}

// ── 상수 ──────────────────────────────────────────────
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const BAR_H = 22   // px per lane (bar height + gap)

const COLORS: Record<string, { chip: string; dot: string; bar: string }> = {
  rose:    { chip: 'bg-rose-100 text-rose-700',    dot: 'bg-rose-400',    bar: 'bg-rose-300 text-rose-900'    },
  sky:     { chip: 'bg-sky-100 text-sky-700',      dot: 'bg-sky-400',     bar: 'bg-sky-300 text-sky-900'      },
  amber:   { chip: 'bg-amber-100 text-amber-700',  dot: 'bg-amber-400',   bar: 'bg-amber-300 text-amber-900'  },
  emerald: { chip: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-400', bar: 'bg-emerald-300 text-emerald-900' },
  violet:  { chip: 'bg-violet-100 text-violet-700',dot: 'bg-violet-400',  bar: 'bg-violet-300 text-violet-900'},
}

// ── 유틸 ──────────────────────────────────────────────
function fmtDk(y: number, m: number, d: number) {
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

function sortedPair(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a]
}

function datesInRange(a: string, b: string): string[] {
  const [s, e] = sortedPair(a, b)
  const result: string[] = []
  const cur = new Date(s + 'T12:00:00')
  const end = new Date(e + 'T12:00:00')
  while (cur <= end) {
    result.push(fmtDk(cur.getFullYear(), cur.getMonth(), cur.getDate()))
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
  return `${fmtDate(s)} – ${fmtDate(e)} (${datesInRange(s, e).length}일)`
}

// 구 형식(EventMap) → RangeEvent[] 마이그레이션
function migrate(data: unknown): RangeEvent[] {
  if (Array.isArray(data)) return data as RangeEvent[]
  if (typeof data !== 'object' || !data) return []
  const result: RangeEvent[] = []
  let id = 0
  for (const [dk, evs] of Object.entries(data as Record<string, unknown[]>)) {
    for (const ev of (evs as Array<{ title: string; color: string }>)) {
      result.push({ id: id++, title: ev.title, color: ev.color, start: dk, end: dk })
    }
  }
  return result
}

// 주 데이터 계산 (바 레이아웃 포함)
function computeWeeks(year: number, month: number, events: RangeEvent[]): WeekRow[] {
  const calDays = getCalDays(year, month)
  const rows: WeekRow[] = []

  for (let w = 0; w < calDays.length / 7; w++) {
    const slice = calDays.slice(w * 7, w * 7 + 7)
    const keys: (string | null)[] = slice.map(d => d !== null ? fmtDk(year, month, d) : null)
    const valid = keys.filter((k): k is string => k !== null)
    if (valid.length === 0) { rows.push({ days: keys, bars: [], numLanes: 0 }); continue }

    const wsKey = valid[0]
    const weKey = valid[valid.length - 1]

    // 이 주에 걸치는 멀티데이 이벤트
    const overlapping = events
      .filter(ev => ev.start !== ev.end)
      .filter(ev => ev.start <= weKey && ev.end >= wsKey)
      .sort((a, b) => a.start < b.start ? -1 : 1)

    const laneEndCols: number[] = []
    const bars: Bar[] = []

    for (const ev of overlapping) {
      const cs = ev.start < wsKey ? wsKey : ev.start
      const ce = ev.end   > weKey ? weKey : ev.end
      const sc = keys.findIndex(k => k === cs)
      const ec = keys.findIndex(k => k === ce)
      if (sc < 0 || ec < 0) continue
      const span = ec - sc + 1

      let lane = laneEndCols.findIndex(end => end <= sc)
      if (lane === -1) { lane = laneEndCols.length; laneEndCols.push(0) }
      laneEndCols[lane] = ec + 1

      bars.push({ event: ev, startCol: sc, span, lane,
        isStart: ev.start >= wsKey, isEnd: ev.end <= weKey })
    }

    rows.push({ days: keys, bars, numLanes: laneEndCols.length })
  }
  return rows
}

// ── 컴포넌트 ──────────────────────────────────────────
export default function CalendarView() {
  const today = new Date()
  const [viewYear,  setViewYear]  = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [events,    setEvents]    = useState<RangeEvent[]>([])
  const [nextId,    setNextId]    = useState(0)

  const [selStart, setSelStart] = useState<string | null>(null)
  const [selEnd,   setSelEnd]   = useState<string | null>(null)
  const dragging = useRef(false)

  const [inputText,     setInputText]     = useState('')
  const [selectedColor, setSelectedColor] = useState('rose')
  const inputRef = useRef<HTMLInputElement>(null)
  const gridRef  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadCalendarEvents().then(data => {
      if (!data) return
      const mapped: RangeEvent[] = data.map((row: { local_id: number; title: string; color: string; start_date: string; end_date: string }) => ({
        id: row.local_id,
        title: row.title,
        color: row.color,
        start: row.start_date,
        end: row.end_date,
      }))
      setEvents(mapped)
      if (mapped.length > 0) setNextId(Math.max(...mapped.map(e => e.id)) + 1)
    })
  }, [])

  useEffect(() => {
    if (selStart) setTimeout(() => inputRef.current?.focus(), 60)
  }, [selStart])

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const [rs, re] = (selStart && selEnd) ? sortedPair(selStart, selEnd)
    : selStart ? [selStart, selStart] : ['', '']
  const rangeDates = rs ? datesInRange(rs, re) : []

  const startDrag = (key: string) => { dragging.current = true; setSelStart(key); setSelEnd(key) }
  const extendDrag = (key: string) => { if (dragging.current) setSelEnd(key) }
  const endDrag = () => { dragging.current = false }

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!dragging.current) return
    e.preventDefault()
    const t = e.touches[0]
    const date = document.elementFromPoint(t.clientX, t.clientY)
      ?.closest('[data-date]')?.getAttribute('data-date')
    if (date) setSelEnd(date)
  }, [])

  useEffect(() => {
    const g = gridRef.current
    if (!g) return
    g.addEventListener('touchmove', handleTouchMove, { passive: false })
    return () => g.removeEventListener('touchmove', handleTouchMove)
  }, [handleTouchMove])

  const addEvent = () => {
    const title = inputText.trim()
    if (!title || !rs) return
    const [s, e] = sortedPair(rs, re)
    const next = [...events, { id: nextId, title, color: selectedColor, start: s, end: e }]
    setEvents(next); setNextId(nextId + 1)
    saveCalendarEvent({ local_id: nextId, title, color: selectedColor, start: s, end: e })
    setInputText('')
  }

  const deleteEvent = (id: number) => {
    setEvents(events.filter(e => e.id !== id))
    deleteCalendarEvent(id)
  }

  const closePanel = () => { setSelStart(null); setSelEnd(null); setInputText('') }

  const isToday = (dk: string) => {
    const [y, m, d] = dk.split('-').map(Number)
    return y === today.getFullYear() && m - 1 === today.getMonth() && d === today.getDate()
  }

  const weeks = computeWeeks(viewYear, viewMonth, events)
  const panelEvents = rs ? events.filter(ev => ev.start <= re && ev.end >= rs) : []

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-purple-50 to-sky-50 px-4 py-10">
      <header className="mb-6 text-center">
        <h1 className="text-3xl font-bold text-slate-600 tracking-wide">캘린더</h1>
        <p className="mt-1 text-sm text-slate-400">날짜를 클릭하거나 드래그해서 일정을 추가하세요</p>
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
        <div className="bg-white/60 rounded-2xl shadow-sm ring-1 ring-black/5 overflow-hidden"
          onMouseUp={endDrag} onMouseLeave={endDrag}>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 border-b border-black/5">
            {WEEKDAYS.map((d, i) => (
              <div key={d} className={`py-2 text-center text-xs font-semibold
                ${i === 0 ? 'text-rose-400' : i === 6 ? 'text-sky-400' : 'text-slate-500'}`}>{d}</div>
            ))}
          </div>

          {/* 주 행들 */}
          <div ref={gridRef} onTouchEnd={endDrag}>
            {weeks.map((week, wi) => {
              const isLast = wi === weeks.length - 1
              return (
                <div key={wi} className={isLast ? '' : 'border-b border-black/5'}>

                  {/* 날짜 숫자 + 단일 일정 칩 */}
                  <div className="grid grid-cols-7">
                    {week.days.map((dk, di) => {
                      const dayNum = dk ? parseInt(dk.split('-')[2]) : null
                      const isEdge = dk === rs || dk === re
                      const inSel  = dk ? (dk >= rs && dk <= re && rs !== '') : false
                      const singleEvs = dk ? events.filter(ev => ev.start === ev.end && ev.start === dk) : []
                      const dow = di

                      return (
                        <div key={di}
                          data-date={dk ?? undefined}
                          onMouseDown={() => dk && startDrag(dk)}
                          onMouseEnter={() => dk && extendDrag(dk)}
                          onTouchStart={() => dk && startDrag(dk)}
                          className={[
                            'min-h-[44px] px-1 pt-1 pb-0.5 border-r border-black/5 last:border-r-0 select-none',
                            dk ? 'cursor-pointer transition-colors' : '',
                            isEdge ? 'bg-violet-200/70' : inSel ? 'bg-violet-100/60' : dk ? 'hover:bg-violet-50/40' : '',
                          ].join(' ')}
                        >
                          {dayNum && (
                            <>
                              <span className={[
                                'inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-medium mb-0.5',
                                isToday(dk!) ? 'bg-violet-400 text-white' : '',
                                !isToday(dk!) && dow === 0 ? 'text-rose-400' : '',
                                !isToday(dk!) && dow === 6 ? 'text-sky-400' : '',
                                !isToday(dk!) && dow > 0 && dow < 6 ? 'text-slate-600' : '',
                              ].join(' ')}>{dayNum}</span>

                              {/* 단일 일정 칩 */}
                              {singleEvs.slice(0, 2).map(ev => {
                                const c = COLORS[ev.color] ?? COLORS.violet
                                return (
                                  <div key={ev.id}
                                    onClick={e => { e.stopPropagation(); setSelStart(ev.start); setSelEnd(ev.end) }}
                                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md truncate leading-tight mb-0.5 cursor-pointer ${c.chip}`}>
                                    {ev.title}
                                  </div>
                                )
                              })}
                              {singleEvs.length > 2 && (
                                <div className="text-[10px] text-slate-400 px-1">+{singleEvs.length - 2}</div>
                              )}
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {/* 멀티데이 이벤트 바 영역 */}
                  <div className="relative"
                    style={{ minHeight: week.numLanes > 0 ? week.numLanes * BAR_H + 6 : 0 }}>
                    {/* 컬럼 구분선 */}
                    <div className="absolute inset-0 grid grid-cols-7 pointer-events-none">
                      {Array(7).fill(null).map((_, i) => (
                        <div key={i} className="border-r border-black/5 last:border-r-0" />
                      ))}
                    </div>

                    {week.bars.map(bar => {
                      const c = COLORS[bar.event.color] ?? COLORS.violet
                      return (
                        <div
                          key={`${bar.event.id}-${wi}`}
                          onClick={() => { setSelStart(bar.event.start); setSelEnd(bar.event.end) }}
                          className={[
                            'absolute flex items-center px-2 text-[11px] font-semibold truncate cursor-pointer hover:brightness-95 transition-all',
                            c.bar,
                            bar.isStart ? 'rounded-l-full' : 'rounded-l-none',
                            bar.isEnd   ? 'rounded-r-full' : 'rounded-r-none',
                          ].join(' ')}
                          style={{
                            left:   `calc(${(bar.startCol / 7) * 100}% + 2px)`,
                            width:  `calc(${(bar.span    / 7) * 100}% - 4px)`,
                            top:    bar.lane * BAR_H + 3,
                            height: BAR_H - 5,
                          }}
                        >
                          {bar.isStart && bar.event.title}
                        </div>
                      )
                    })}
                  </div>

                </div>
              )
            })}
          </div>
        </div>

        {/* 패널 */}
        {rs && (
          <div className="mt-4 bg-white/70 rounded-2xl shadow-sm ring-1 ring-black/5 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-violet-100">
              <span className="font-semibold text-slate-700">{fmtRange(rs, re)}</span>
              <button onClick={closePanel}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none">×</button>
            </div>

            {/* 날짜 범위 조정 */}
            <div className="px-4 pt-3 flex items-end gap-2">
              <div className="flex-1">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">시작일</label>
                <input type="date" value={rs} onChange={e => setSelStart(e.target.value)}
                  className="mt-1 w-full text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-1.5 outline-none ring-1 ring-black/10 focus:ring-violet-300 transition-colors" />
              </div>
              <span className="text-slate-300 pb-2 text-lg">–</span>
              <div className="flex-1">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">종료일</label>
                <input type="date" value={re} min={rs} onChange={e => setSelEnd(e.target.value)}
                  className="mt-1 w-full text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-1.5 outline-none ring-1 ring-black/10 focus:ring-violet-300 transition-colors" />
              </div>
            </div>

            {/* 기존 일정 */}
            <div className="px-4 py-3 space-y-2">
              {panelEvents.length === 0 && <p className="text-sm text-slate-400 text-center py-1">일정이 없습니다</p>}
              {panelEvents.map(ev => {
                const c = COLORS[ev.color] ?? COLORS.violet
                return (
                  <div key={ev.id} className="group flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
                    <span className="flex-1 text-sm text-slate-700">{ev.title}</span>
                    <span className="text-[11px] text-slate-400 flex-shrink-0">
                      {ev.start === ev.end ? fmtDate(ev.start) : `${fmtDate(ev.start)}–${fmtDate(ev.end)}`}
                    </span>
                    <button onClick={() => deleteEvent(ev.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 text-lg leading-none transition-opacity">×</button>
                  </div>
                )
              })}
            </div>

            {/* 일정 추가 */}
            <div className="px-4 pb-4 space-y-2">
              <div className="flex gap-1.5">
                {Object.entries(COLORS).map(([key, c]) => (
                  <button key={key} onClick={() => setSelectedColor(key)}
                    className={`w-6 h-6 rounded-full transition-transform ${c.dot}
                      ${selectedColor === key ? 'scale-125 ring-2 ring-offset-1 ring-slate-400' : 'opacity-60 hover:opacity-100'}`} />
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
                  className="bg-violet-200 hover:bg-violet-300 text-slate-700 font-medium text-sm px-4 py-2 rounded-xl transition-colors">추가</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
