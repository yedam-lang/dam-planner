'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null)
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div className="h-screen flex items-center justify-center text-pink-300">
      로딩 중...
    </div>
  )

  if (!user) return (
    <div className="h-screen flex flex-col items-center justify-center gap-4 bg-pink-50">
      <h1 className="text-2xl font-bold text-pink-400">담 플래너</h1>
      {sent ? (
        <p className="text-gray-500">📧 이메일을 확인해줘! 링크 클릭하면 로그인돼.</p>
      ) : (
        <>
          <input
            type="email"
            placeholder="이메일 입력"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="border border-pink-200 rounded-xl px-4 py-2 w-64 outline-none focus:ring-2 focus:ring-pink-300"
          />
          <button
            onClick={async () => {
              await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
              setSent(true)
            }}
            className="bg-pink-300 hover:bg-pink-400 text-white rounded-xl px-6 py-2 font-medium"
          >
            로그인 링크 받기
          </button>
        </>
      )}
    </div>
  )

  return <>{children}</>
}
