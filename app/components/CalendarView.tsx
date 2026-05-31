'use client'

import { useState, useRef, useEffect } from 'react'

type Event = {
  id: number
  title: string
  color: string
}

type EventMap = Record<string, Event[]>

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const COLORS = [
  { key: 'rose',    chip: 'bg-rose-200 text-rose-700',    dot: 'bg-rose-400'    },
  { key: 'sky',     chip: 'bg-sky-200 text-sky-700',      dot: 'bg-sky-400'     },
  { key: 'amber',   chip: 'bg-amber-200 text-amber-700',  dot: 'bg-amber-400'   },
  { key: 'emerald', chip: 'bg-emerald-200 text-emerald-700', dot: 'bg-emerald-400' },
  { key: 'violet',  chip: 'bg-violet-200 text-violet-700', dot: 'bg-violet-400'  },
]

function dateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function getCalendarDays(year: number, month: number): (number | null)[] {
  const firstDow = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const days: (number | null)[] = Array(firstDow).fill(null)
  for (let d = 1; d <= daysInMonth; d++) days.push(d)
  while (days.length % 7 !== 0) days.push(null)
  return days
}

function formatMonth(year: number, month: number) {
  return `${year}년 ${month + 1}월`
}

export default function CalendarView() {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [events, setEvents] = useState<EventMap>({})
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [inputText, setInputText] = useState('')
  const [selectedColor, setSelectedColor] = useState('rose')
  const [nextId, setNextId] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

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
    if (selectedKey) inputRef.current?.focus()
  }, [selectedKey])

  const saveEvents = (next: EventMap, nid: number) => {
    try { localStorage.setItem('dam-calendar-events', JSON.stringify({ events: next, nextId: nid })) } catch {}
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const addEvent = () => {
    const title = inputText.trim()
    if (!title || !selectedKey) return
    const next = {
      ...events,
      [selectedKey]: [...(events[selectedKey] ?? []), { id: nextId, title, color: selectedColor }],
    }
    const nid = nextId + 1
    setEvents(next)
    setNextId(nid)
    saveEvents(next, nid)
    setInputText('')
  }

  const deleteEvent = (key: string, id: number) => {
    const next = { ...events, [key]: (events[key] ?? []).filter(e => e.id !== id) }
    setEvents(next)
    saveEvents(next, nextId)
  }

  const calDays = getCalendarDays(viewYear, viewMonth)

  const selectedEvents = selectedKey ? (events[selectedKey] ?? []) : []
  const [selYear, selMonth, selDay] = selectedKey
    ? selectedKey.split('-').map(Number)
    : [0, 0, 0]

  const isToday = (day: number) =>
    day === today.getDate() &&
    viewMonth === today.getMonth() &&
    viewYear === today.getFullYear()

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-purple-50 to-sky-50 px-4 py-10">
      <header className="mb-6 text-center">
        <h1 className="text-3xl font-bold text-slate-600 tracking-wide">캘린더</h1>
        <p className="mt-1 text-sm text-slate-400">날짜를 클릭해 일정을 추가하세요</p>
      </header>

      <div className="max-w-2xl mx-auto">
        {/* 월 네비게이션 */}
        <div className="flex items-center justify-between mb-4 px-1">
          <button
            onClick={prevMonth}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/60 hover:bg-white/90 text-slate-500 transition-colors shadow-sm"
          >
            ‹
          </button>
          <span className="font-semibold text-slate-600 text-lg">
            {formatMonth(viewYear, viewMonth)}
          </span>
          <button
            onClick={nextMonth}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/60 hover:bg-white/90 text-slate-500 transition-colors shadow-sm"
          >
            ›
          </button>
        </div>

        {/* 캘린더 */}
        <div className="bg-white/60 rounded-2xl shadow-sm ring-1 ring-black/5 overflow-hidden">
          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 border-b border-black/5">
            {WEEKDAYS.map((d, i) => (
              <div
                key={d}
                className={`py-2 text-center text-xs font-semibold
                  ${i === 0 ? 'text-rose-400' : i === 6 ? 'text-sky-400' : 'text-slate-500'}`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* 날짜 셀 */}
          <div className="grid grid-cols-7">
            {calDays.map((day, idx) => {
              const key = day ? dateKey(viewYear, viewMonth, day) : null
              const dayEvents = key ? (events[key] ?? []) : []
              const isSelected = key === selectedKey
              const dow = idx % 7

              return (
                <div
                  key={idx}
                  onClick={() => day && setSelectedKey(key)}
                  className={`
                    min-h-[72px] p-1.5 border-b border-r border-black/5 last:border-r-0
                    ${day ? 'cursor-pointer hover:bg-violet-50/60 transition-colors' : ''}
                    ${isSelected ? 'bg-violet-50' : ''}
                  `}
                >
                  {day && (
                    <>
                      <span
                        className={`
                          inline-flex w-6 h-6 items-center justify-center rounded-full text-xs font-medium mb-1
                          ${isToday(day) ? 'bg-violet-400 text-white' : ''}
                          ${!isToday(day) && dow === 0 ? 'text-rose-400' : ''}
                          ${!isToday(day) && dow === 6 ? 'text-sky-400' : ''}
                          ${!isToday(day) && dow !== 0 && dow !== 6 ? 'text-slate-600' : ''}
                        `}
                      >
                        {day}
                      </span>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 2).map(ev => {
                          const c = COLORS.find(c => c.key === ev.color) ?? COLORS[0]
                          return (
                            <div
                              key={ev.id}
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md truncate leading-tight ${c.chip}`}
                            >
                              {ev.title}
                            </div>
                          )
                        })}
                        {dayEvents.length > 2 && (
                          <div className="text-[10px] text-slate-400 px-1">
                            +{dayEvents.length - 2}개
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 선택된 날짜 패널 */}
        {selectedKey && (
          <div className="mt-4 bg-white/70 rounded-2xl shadow-sm ring-1 ring-black/5 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-violet-100">
              <span className="font-semibold text-slate-700">
                {selMonth}월 {selDay}일
              </span>
              <button
                onClick={() => setSelectedKey(null)}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            {/* 일정 목록 */}
            <div className="px-4 py-3 space-y-2">
              {selectedEvents.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-2">일정이 없습니다</p>
              )}
              {selectedEvents.map(ev => {
                const c = COLORS.find(c => c.key === ev.color) ?? COLORS[0]
                return (
                  <div key={ev.id} className="group flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
                    <span className="flex-1 text-sm text-slate-700">{ev.title}</span>
                    <button
                      onClick={() => deleteEvent(selectedKey, ev.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 text-lg leading-none transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>

            {/* 일정 추가 */}
            <div className="px-4 pb-4 flex flex-col gap-2">
              <div className="flex gap-1.5">
                {COLORS.map(c => (
                  <button
                    key={c.key}
                    onClick={() => setSelectedColor(c.key)}
                    className={`w-6 h-6 rounded-full transition-transform ${c.dot}
                      ${selectedColor === c.key ? 'scale-125 ring-2 ring-offset-1 ring-slate-400' : 'opacity-60 hover:opacity-100'}`}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addEvent()}
                  placeholder="일정 이름 입력..."
                  className="flex-1 text-sm rounded-xl px-3 py-2 bg-white/80 placeholder:text-slate-400 text-slate-700 outline-none focus:bg-white ring-1 ring-black/10 transition-colors"
                />
                <button
                  onClick={addEvent}
                  className="bg-violet-200 hover:bg-violet-300 text-slate-700 font-medium text-sm px-4 py-2 rounded-xl transition-colors"
                >
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
