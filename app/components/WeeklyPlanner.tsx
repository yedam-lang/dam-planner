'use client'

import { useState, useEffect, useRef, KeyboardEvent } from 'react'
import DrawingCanvas from './DrawingCanvas'

type Todo = { id: number; text: string; done: boolean }
type CalEvent = { id: number; title: string; color: string; dateKey: string }

const DAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

const DAY_STYLES = [
  { bg: 'bg-rose-50',    header: 'bg-rose-200',    accent: 'accent-rose-400',    btn: 'bg-rose-200 hover:bg-rose-300'    },
  { bg: 'bg-orange-50',  header: 'bg-orange-200',  accent: 'accent-orange-400',  btn: 'bg-orange-200 hover:bg-orange-300'  },
  { bg: 'bg-amber-50',   header: 'bg-amber-200',   accent: 'accent-amber-400',   btn: 'bg-amber-200 hover:bg-amber-300'   },
  { bg: 'bg-emerald-50', header: 'bg-emerald-200', accent: 'accent-emerald-400', btn: 'bg-emerald-200 hover:bg-emerald-300' },
  { bg: 'bg-sky-50',     header: 'bg-sky-200',     accent: 'accent-sky-400',     btn: 'bg-sky-200 hover:bg-sky-300'     },
  { bg: 'bg-violet-50',  header: 'bg-violet-200',  accent: 'accent-violet-400',  btn: 'bg-violet-200 hover:bg-violet-300'  },
  { bg: 'bg-pink-50',    header: 'bg-pink-200',    accent: 'accent-pink-400',    btn: 'bg-pink-200 hover:bg-pink-300'    },
]

// ── 날짜 유틸 ──────────────────────────────────────────
function getWeekStart(offset: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay() + offset * 7)
  return d
}

function toKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatRange(start: Date): string {
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const y = start.getFullYear()
  const m1 = start.getMonth() + 1
  const d1 = start.getDate()
  const m2 = end.getMonth() + 1
  const d2 = end.getDate()
  return m1 === m2
    ? `${y}년 ${m1}월 ${d1}–${d2}일`
    : `${y}년 ${m1}월 ${d1}일 – ${m2}월 ${d2}일`
}

function weekLabel(offset: number): string {
  if (offset === 0) return '이번 주'
  if (offset === -1) return '지난 주'
  if (offset === 1) return '다음 주'
  return offset < 0 ? `${-offset}주 전` : `${offset}주 후`
}

// ── localStorage 헬퍼 ───────────────────────────────────
const TODOS_KEY   = (wk: string) => `dam-todos-${wk}`
const GOAL_KEY    = (wk: string) => `dam-goal-${wk}`
const SAVED_KEY   = (wk: string, i: number) => `dam-canvas-saved-${wk}-${i}`
const DAY_KEY     = (wk: string, i: number) => `${wk}-${i}`
const CHECKED_KEY = (wk: string) => `dam-cal-checked-${wk}`

function loadTodos(wk: string): Todo[][] {
  try {
    const raw = localStorage.getItem(TODOS_KEY(wk))
    if (raw) return JSON.parse(raw)
  } catch {}
  return DAYS.map(() => [])
}

function loadGoal(wk: string): string {
  return localStorage.getItem(GOAL_KEY(wk)) ?? ''
}

function loadWeekEvents(weekStart: Date): CalEvent[] {
  try {
    const raw = localStorage.getItem('dam-calendar-events')
    if (!raw) return []
    const data = JSON.parse(raw)
    const map: Record<string, Array<{ id: number; title: string; color: string }>> = data.events ?? {}
    const result: CalEvent[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart.getTime() + i * 86400000)
      const dk = toKey(d)
      for (const ev of map[dk] ?? []) result.push({ ...ev, dateKey: dk })
    }
    return result
  } catch {}
  return []
}

function loadChecked(wk: string): Set<number> {
  try {
    const raw = localStorage.getItem(CHECKED_KEY(wk))
    if (raw) return new Set(JSON.parse(raw))
  } catch {}
  return new Set()
}

function PenIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      className="w-3.5 h-3.5">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
}

export default function WeeklyPlanner() {
  const todayDay = new Date().getDay()

  const [weekOffset, setWeekOffset] = useState(0)
  const weekStart  = getWeekStart(weekOffset)
  const weekKey    = toKey(weekStart)
  const isThisWeek = weekOffset === 0

  const [todos,       setTodos]       = useState<Todo[][]>(DAYS.map(() => []))
  const [inputs,      setInputs]      = useState<string[]>(DAYS.map(() => ''))
  const [goal,        setGoal]        = useState('')
  const [canvasOpen,  setCanvasOpen]  = useState<boolean[]>(DAYS.map(() => false))
  const [savedImages, setSavedImages] = useState<(string | null)[]>(DAYS.map(() => null))
  const [calEvents,   setCalEvents]   = useState<CalEvent[]>([])
  const [checked,     setChecked]     = useState<Set<number>>(new Set())

  // 주가 바뀔 때 데이터 로드
  useEffect(() => {
    setTodos(loadTodos(weekKey))
    setGoal(loadGoal(weekKey))
    setInputs(DAYS.map(() => ''))
    setCanvasOpen(DAYS.map(() => false))
    setSavedImages(DAYS.map((_, i) => localStorage.getItem(SAVED_KEY(weekKey, i))))
    setCalEvents(loadWeekEvents(weekStart))
    setChecked(loadChecked(weekKey))
  }, [weekKey])  // eslint-disable-line react-hooks/exhaustive-deps

  const toggleChecked = (id: number) => {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      try { localStorage.setItem(CHECKED_KEY(weekKey), JSON.stringify([...next])) } catch {}
      return next
    })
  }

  // ── Todo ───────────────────────────────────────────────
  const addTodo = (dayIdx: number) => {
    const text = inputs[dayIdx].trim()
    if (!text) return
    const next = todos.map((list, i) =>
      i === dayIdx ? [...list, { id: Date.now(), text, done: false }] : list
    )
    setTodos(next)
    try { localStorage.setItem(TODOS_KEY(weekKey), JSON.stringify(next)) } catch {}
    setInputs(prev => prev.map((v, i) => (i === dayIdx ? '' : v)))
  }

  const toggleTodo = (dayIdx: number, id: number) => {
    const next = todos.map((list, i) =>
      i === dayIdx ? list.map(t => t.id === id ? { ...t, done: !t.done } : t) : list
    )
    setTodos(next)
    try { localStorage.setItem(TODOS_KEY(weekKey), JSON.stringify(next)) } catch {}
  }

  const deleteTodo = (dayIdx: number, id: number) => {
    const next = todos.map((list, i) =>
      i === dayIdx ? list.filter(t => t.id !== id) : list
    )
    setTodos(next)
    try { localStorage.setItem(TODOS_KEY(weekKey), JSON.stringify(next)) } catch {}
  }

  const handleKey = (e: KeyboardEvent<HTMLInputElement>, dayIdx: number) => {
    if (e.key === 'Enter') addTodo(dayIdx)
  }

  // ── Canvas ────────────────────────────────────────────
  const toggleCanvas = (dayIdx: number) =>
    setCanvasOpen(prev => prev.map((v, i) => (i === dayIdx ? !v : v)))

  const handleCanvasSave = (dayIdx: number, dataUrl: string) => {
    setSavedImages(prev => prev.map((v, i) => (i === dayIdx ? dataUrl : v)))
    try { localStorage.setItem(SAVED_KEY(weekKey, dayIdx), dataUrl) } catch {}
    setCanvasOpen(prev => prev.map((v, i) => (i === dayIdx ? false : v)))
  }

  const clearSavedImage = (dayIdx: number) => {
    setSavedImages(prev => prev.map((v, i) => (i === dayIdx ? null : v)))
    localStorage.removeItem(SAVED_KEY(weekKey, dayIdx))
  }

  // ── Goal ──────────────────────────────────────────────
  const goalRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const el = goalRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [goal])

  const handleGoal = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setGoal(e.target.value)
    try { localStorage.setItem(GOAL_KEY(weekKey), e.target.value) } catch {}
  }

  // ── Render ────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-purple-50 to-sky-50 px-4 py-10 pb-6">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-slate-600 tracking-wide">담 플래너</h1>

        {/* 주 네비게이션 */}
        <div className="mt-3 flex items-center justify-center gap-3">
          <button
            onClick={() => setWeekOffset(o => o - 1)}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/60 hover:bg-white/90 text-slate-500 shadow-sm transition-colors text-lg leading-none"
          >
            ‹
          </button>

          <div className="text-center">
            <div className="flex items-center gap-2 justify-center">
              <span className="text-sm font-semibold text-slate-600">{formatRange(weekStart)}</span>
              {isThisWeek && (
                <span className="text-[11px] font-medium bg-violet-200 text-violet-700 rounded-full px-2 py-0.5">
                  이번 주
                </span>
              )}
              {!isThisWeek && (
                <span className="text-[11px] text-slate-400">{weekLabel(weekOffset)}</span>
              )}
            </div>
          </div>

          <button
            onClick={() => setWeekOffset(o => o + 1)}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/60 hover:bg-white/90 text-slate-500 shadow-sm transition-colors text-lg leading-none"
          >
            ›
          </button>
        </div>

        {!isThisWeek && (
          <button
            onClick={() => setWeekOffset(0)}
            className="mt-2 text-xs text-violet-500 hover:text-violet-700 transition-colors"
          >
            오늘로 돌아가기
          </button>
        )}
      </header>

<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 max-w-screen-xl mx-auto">

        {/* ── 요일 카드 7개 ─────────────────────────────── */}
        {DAYS.map((dayName, dayIdx) => {
          const style    = DAY_STYLES[dayIdx]
          const isToday  = isThisWeek && dayIdx === todayDay
          const doneCnt  = todos[dayIdx].filter(t => t.done).length
          const totalCnt = todos[dayIdx].length
          const savedImg = savedImages[dayIdx]

          return (
            <div
              key={dayIdx}
              className={`flex flex-col rounded-2xl overflow-hidden shadow-sm transition-shadow
                ${isToday ? 'ring-2 ring-slate-400 shadow-md' : 'ring-1 ring-black/5'}
                ${style.bg}`}
            >
              {/* 헤더 */}
              <div className={`${style.header} px-3 py-2.5 flex items-center justify-between`}>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-semibold text-slate-700 text-sm">{dayName}</span>
                  <span className="text-xs text-slate-500">
                    {weekStart.getMonth() + 1}/{new Date(weekStart.getTime() + dayIdx * 86400000).getDate()}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => toggleCanvas(dayIdx)}
                    className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors
                      ${canvasOpen[dayIdx] ? 'bg-white/80 text-slate-700' : 'bg-white/40 text-slate-600 hover:bg-white/70'}`}
                  >
                    <PenIcon />필기
                  </button>
                  {isToday && (
                    <span className="text-[11px] font-medium bg-white/70 text-slate-600 rounded-full px-2 py-0.5">
                      오늘
                    </span>
                  )}
                </div>
              </div>

              {/* 할 일 목록 */}
              <div className="flex-1 px-3 py-3 space-y-2 min-h-[100px]">
                {todos[dayIdx].map(todo => (
                  <div key={todo.id} className="group flex items-start gap-2">
                    <input
                      type="checkbox" checked={todo.done}
                      onChange={() => toggleTodo(dayIdx, todo.id)}
                      className={`mt-0.5 w-4 h-4 cursor-pointer flex-shrink-0 rounded ${style.accent}`}
                    />
                    <span className={`flex-1 text-sm leading-snug text-slate-700 break-all
                      ${todo.done ? 'line-through text-slate-400' : ''}`}>
                      {todo.text}
                    </span>
                    <button
                      onClick={() => deleteTodo(dayIdx, todo.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 text-lg leading-none mt-0.5 transition-opacity"
                    >×</button>
                  </div>
                ))}
              </div>

              {/* 캘린더 일정 */}
              {(() => {
                const dayDateKey = toKey(new Date(weekStart.getTime() + dayIdx * 86400000))
                const dayEvents = calEvents.filter(ev => ev.dateKey === dayDateKey)
                if (dayEvents.length === 0) return null
                const DOT: Record<string, string> = {
                  rose: 'bg-rose-400', sky: 'bg-sky-400', amber: 'bg-amber-400',
                  emerald: 'bg-emerald-400', violet: 'bg-violet-400',
                }
                return (
                  <div className="px-3 pb-2 space-y-1.5 border-t border-black/5 pt-2">
                    {dayEvents.map(ev => {
                      const done = checked.has(ev.id)
                      return (
                        <label key={ev.id} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={done}
                            onChange={() => toggleChecked(ev.id)}
                            className={`w-3.5 h-3.5 rounded cursor-pointer flex-shrink-0 ${style.accent}`}
                          />
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${DOT[ev.color] ?? 'bg-slate-400'}`} />
                          <span className={`text-xs leading-snug flex-1 transition-colors
                            ${done ? 'line-through text-slate-400' : 'text-slate-600'}`}>
                            {ev.title}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )
              })()}

              {/* 저장된 필기 이미지 */}
              {savedImg && !canvasOpen[dayIdx] && (
                <div className="px-3 pb-2 group/img relative">
                  <img src={savedImg} alt="필기" className="w-full rounded-lg ring-1 ring-black/10" />
                  <div className="absolute top-1 right-4 flex gap-1 opacity-0 group-hover/img:opacity-100 transition-opacity">
                    <button onClick={() => toggleCanvas(dayIdx)}
                      className="text-[10px] bg-white/90 text-slate-600 rounded-md px-2 py-0.5 shadow-sm hover:bg-white">
                      편집
                    </button>
                    <button onClick={() => clearSavedImage(dayIdx)}
                      className="text-[10px] bg-white/90 text-slate-500 rounded-md px-2 py-0.5 shadow-sm hover:bg-white">
                      삭제
                    </button>
                  </div>
                </div>
              )}

              {/* 필기 캔버스 */}
              {canvasOpen[dayIdx] && (
                <div className="px-3 pb-2">
                  <DrawingCanvas
                    dayKey={DAY_KEY(weekKey, dayIdx)}
                    headerBg={style.header}
                    onSave={dataUrl => handleCanvasSave(dayIdx, dataUrl)}
                    onClose={() => toggleCanvas(dayIdx)}
                  />
                </div>
              )}

              {/* 진행률 */}
              {totalCnt > 0 && (
                <div className="px-3 pb-1">
                  <div className="h-1 rounded-full bg-black/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-slate-400/60 transition-all duration-300"
                      style={{ width: `${(doneCnt / totalCnt) * 100}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1 text-right">{doneCnt}/{totalCnt}</p>
                </div>
              )}

              {/* 입력 */}
              <div className="px-3 pb-3 flex gap-1.5">
                <input
                  type="text" value={inputs[dayIdx]}
                  onChange={e => setInputs(prev => prev.map((v, i) => (i === dayIdx ? e.target.value : v)))}
                  onKeyDown={e => handleKey(e, dayIdx)}
                  placeholder="할 일 추가..."
                  className="flex-1 text-sm rounded-lg px-3 py-1.5 bg-white/60 placeholder:text-slate-400 text-slate-700 outline-none focus:bg-white/90 transition-colors"
                />
                <button
                  onClick={() => addTodo(dayIdx)}
                  className={`${style.btn} rounded-lg px-3 py-1.5 text-slate-700 font-bold text-base leading-none transition-colors`}
                >+</button>
              </div>
            </div>
          )
        })}

        {/* ── 주간 목표 카드 ────────────────────────────── */}
        <div className="flex flex-col rounded-2xl overflow-hidden shadow-sm ring-1 ring-yellow-200 bg-yellow-50">
          <div className="bg-yellow-200 px-3 py-2.5 flex items-center gap-2">
            <span className="text-base">⭐</span>
            <span className="font-semibold text-slate-700 text-sm">주간 목표</span>
          </div>
          <div className="flex-1 px-3 py-3">
            <textarea
              ref={goalRef}
              value={goal}
              onChange={handleGoal}
              placeholder={"이번 주\n목표를 적어보세요"}
              className="w-full text-sm text-slate-700 placeholder:text-slate-400 bg-transparent outline-none resize-none leading-relaxed min-h-[140px]"
            />
          </div>
        </div>

      </div>
    </div>
  )
}
