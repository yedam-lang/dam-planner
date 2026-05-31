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