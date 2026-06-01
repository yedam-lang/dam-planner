'use client'

import { useState, useEffect, useRef, KeyboardEvent } from 'react'
import {
  loadTodos as dbLoadTodos,
  upsertTodo,
  deleteTodo as dbDeleteTodo,
  loadWeekGoal,
  saveWeekGoal,
  loadWeekCalendarEvents,
  loadDiaryEntry,
  saveDiaryEntry,
} from '@/lib/db'

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

function getWeekDates(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })
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

// ── localStorage 헬퍼 ──────────────────────────────────
const CHECKED_KEY = (wk: string) => `dam-cal-checked-${wk}`

function loadChecked(wk: string): Set<number> {
  try {
    const raw = localStorage.getItem(CHECKED_KEY(wk))
    if (raw) return new Set(JSON.parse(raw))
  } catch {}
  return new Set()
}

export default function WeeklyPlanner() {
  const todayDay = new Date().getDay()

  const [weekOffset, setWeekOffset] = useState(0)
  const weekStart  = getWeekStart(weekOffset)
  const weekDates  = getWeekDates(weekStart)
  const weekKey    = toKey(weekStart)
  const isThisWeek = weekOffset === 0

  const [todos,      setTodos]      = useState<Todo[][]>(DAYS.map(() => []))
  const [inputs,     setInputs]     = useState<string[]>(DAYS.map(() => ''))
  const [goal,       setGoal]       = useState('')
  const [diaryOpen,  setDiaryOpen]  = useState<boolean[]>(DAYS.map(() => false))
  const [diaryTexts, setDiaryTexts] = useState<string[]>(DAYS.map(() => ''))
  const [calEvents,  setCalEvents]  = useState<CalEvent[]>([])
  const [checked,    setChecked]    = useState<Set<number>>(new Set())
  const diaryTimers = useRef<(ReturnType<typeof setTimeout> | null)[]>(DAYS.map(() => null))

  // 주가 바뀔 때 데이터 로드
  useEffect(() => {
    setInputs(DAYS.map(() => ''))
    setDiaryOpen(DAYS.map(() => false))
    setDiaryTexts(DAYS.map(() => ''))
    setChecked(loadChecked(weekKey))

    dbLoadTodos(weekKey).then(data => {
      if (!data) return
      const grid: Todo[][] = DAYS.map(() => [])
      for (const row of data as { day_index: number; local_id: number; text: string; done: boolean }[]) {
        if (row.day_index >= 0 && row.day_index < 7) {
          grid[row.day_index].push({ id: row.local_id, text: row.text, done: row.done })
        }
      }
      setTodos(grid)
    })

    loadWeekGoal(weekKey).then(setGoal)
    loadWeekCalendarEvents(weekStart).then(setCalEvents)

    DAYS.forEach((_, i) => {
      loadDiaryEntry(weekKey, i).then(content => {
        setDiaryTexts(prev => prev.map((v, idx) => idx === i ? content : v))
      })
    })
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
    const localId = Math.floor(Math.random() * 2000000000)
    const newTodo: Todo = { id: localId, text, done: false }
    setTodos(prev => prev.map((list, i) => i === dayIdx ? [...list, newTodo] : list))
    upsertTodo({ week_key: weekKey, day_index: dayIdx, local_id: localId, text, done: false })
      .catch(err => console.error('[upsertTodo] addTodo 실패:', err))
    setInputs(prev => prev.map((v, i) => (i === dayIdx ? '' : v)))
  }

  const toggleTodo = (dayIdx: number, id: number) => {
    setTodos(prev => {
      const next = prev.map((list, i) =>
        i === dayIdx ? list.map(t => t.id === id ? { ...t, done: !t.done } : t) : list
      )
      const todo = next[dayIdx].find(t => t.id === id)
      if (todo) upsertTodo({ week_key: weekKey, day_index: dayIdx, local_id: id, text: todo.text, done: todo.done })
        .catch(err => console.error('[upsertTodo] toggleTodo 실패:', err))
      return next
    })
  }

  const deleteTodo = (dayIdx: number, id: number) => {
    setTodos(prev => prev.map((list, i) => i === dayIdx ? list.filter(t => t.id !== id) : list))
    dbDeleteTodo(weekKey, id)
  }

  const handleKey = (e: KeyboardEvent<HTMLInputElement>, dayIdx: number) => {
    if (e.key === 'Enter') addTodo(dayIdx)
  }

  // ── Diary ─────────────────────────────────────────────
  const toggleDiary = (dayIdx: number) =>
    setDiaryOpen(prev => prev.map((v, i) => i === dayIdx ? !v : v))

  const handleDiary = (dayIdx: number, value: string) => {
    setDiaryTexts(prev => prev.map((v, i) => i === dayIdx ? value : v))
    if (diaryTimers.current[dayIdx]) clearTimeout(diaryTimers.current[dayIdx]!)
    diaryTimers.current[dayIdx] = setTimeout(() => {
      saveDiaryEntry(weekKey, dayIdx, value)
    }, 500)
  }

  // ── Goal ──────────────────────────────────────────────
  const goalRef = useRef<HTMLTextAreaElement>(null)
  const goalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const el = goalRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [goal])

  const handleGoal = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setGoal(value)
    if (goalTimerRef.current) clearTimeout(goalTimerRef.current)
    goalTimerRef.current = setTimeout(() => {
      saveWeekGoal(weekKey, value)
    }, 300)
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
                    {weekDates[dayIdx].getMonth() + 1}/{weekDates[dayIdx].getDate()}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => toggleDiary(dayIdx)}
                    className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors
                      ${diaryOpen[dayIdx] ? 'bg-white/80 text-slate-700' : 'bg-white/40 text-slate-600 hover:bg-white/70'}`}
                  >
                    ✏️ 일기
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
                const dayDateKey = toKey(weekDates[dayIdx])
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

              {/* 일기 입력창 */}
              {diaryOpen[dayIdx] && (
                <div className="px-3 pb-2">
                  <textarea
                    value={diaryTexts[dayIdx]}
                    onChange={e => handleDiary(dayIdx, e.target.value)}
                    placeholder="오늘 하루를 기록해보세요..."
                    rows={4}
                    className="w-full text-sm text-slate-700 bg-white/70 rounded-xl px-3 py-2.5 outline-none ring-1 ring-black/10 focus:ring-violet-300 transition-colors placeholder:text-slate-400 resize-none leading-relaxed"
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