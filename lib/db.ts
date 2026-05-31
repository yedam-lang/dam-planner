import { supabase } from './supabase'

export async function getUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

// 캘린더 이벤트
export async function loadCalendarEvents() {
  const uid = await getUserId()
  if (!uid) return null
  const { data } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('user_id', uid)
    .order('start_date')
  return data
}

export async function saveCalendarEvent(event: {
  local_id: number
  title: string
  color: string
  start: string
  end: string
}) {
  const uid = await getUserId()
  if (!uid) return
  await supabase.from('calendar_events').upsert({
    user_id: uid,
    local_id: event.local_id,
    title: event.title,
    color: event.color,
    start_date: event.start,
    end_date: event.end,
  }, { onConflict: 'user_id,local_id' })
}

export async function deleteCalendarEvent(local_id: number) {
  const uid = await getUserId()
  if (!uid) return
  await supabase.from('calendar_events')
    .delete()
    .eq('user_id', uid)
    .eq('local_id', local_id)
}

// ── Todos ──────────────────────────────────────────────
export async function loadTodos(weekKey: string) {
  const uid = await getUserId()
  if (!uid) return null
  const { data } = await supabase
    .from('todos')
    .select('*')
    .eq('user_id', uid)
    .eq('week_date', weekKey)
    .order('local_id')
  return data
}

export async function upsertTodo(todo: {
  week_key: string
  day_index: number
  local_id: number
  text: string
  done: boolean
}) {
  const uid = await getUserId()
  if (!uid) return
  await supabase.from('todos').upsert({
    user_id: uid,
    week_date: todo.week_key,
    day_index: todo.day_index,
    local_id: todo.local_id,
    text: todo.text,
    done: todo.done,
  })
}

export async function deleteTodo(weekKey: string, local_id: number) {
  const uid = await getUserId()
  if (!uid) return
  await supabase.from('todos')
    .delete()
    .eq('user_id', uid)
    .eq('week_date', weekKey)
    .eq('local_id', local_id)
}

// ── Week Goals ─────────────────────────────────────────
export async function loadWeekGoal(weekKey: string): Promise<string> {
  const uid = await getUserId()
  if (!uid) return ''
  const { data } = await supabase
    .from('week_goals')
    .select('goal')
    .eq('user_id', uid)
    .eq('week_date', weekKey)
    .maybeSingle()
  return data?.goal ?? ''
}

export async function saveWeekGoal(weekKey: string, goal: string) {
  const uid = await getUserId()
  if (!uid) return
  await supabase.from('week_goals').upsert({
    user_id: uid,
    week_date: weekKey,
    goal,
  }, { onConflict: 'user_id,week_date' })
}

// ── Week Calendar Events (from calendar_events table) ──
export async function loadWeekCalendarEvents(weekStart: Date) {
  const uid = await getUserId()
  if (!uid) return []
  const weekKeys: string[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart.getTime() + i * 86400000)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const rangeStart = weekKeys[0]
  const rangeEnd   = weekKeys[6]
  const { data } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('user_id', uid)
    .lte('start_date', rangeEnd)
    .gte('end_date', rangeStart)
  if (!data) return []
  const result: { id: number; title: string; color: string; dateKey: string }[] = []
  for (const ev of data) {
    for (const dk of weekKeys) {
      if (dk >= ev.start_date && dk <= ev.end_date) {
        result.push({ id: ev.local_id, title: ev.title, color: ev.color, dateKey: dk })
      }
    }
  }
  return result
}