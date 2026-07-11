'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function SideDecor({ user, variant = 'user' }) {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (variant === 'user' && user) loadUserStats()
    if (variant === 'admin') loadAdminStats()
  }, [user, variant])

  const loadUserStats = async () => {
    const { count: totalCount, error: countError } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .neq('category', 'Inbox')

    if (countError) {
      console.error('SideDecor count error:', countError.message)
      setError(countError.message)
      return
    }

    const { data: recent, error: recentError } = await supabase
      .from('documents')
      .select('file_name, created_at')
      .neq('category', 'Inbox')
      .order('created_at', { ascending: false })
      .limit(3)

    if (recentError) {
      console.error('SideDecor recent error:', recentError.message)
      setError(recentError.message)
      return
    }

    setStats({ total: totalCount || 0, recent: recent || [] })
  }

  const loadAdminStats = async () => {
    const { count: totalUsers, error: usersError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })

    if (usersError) {
      console.error('SideDecor admin users error:', usersError.message)
      setError(usersError.message)
      return
    }

    const { count: pending, error: pendingError } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('approved', false)

    if (pendingError) {
      console.error('SideDecor admin pending error:', pendingError.message)
      setError(pendingError.message)
      return
    }

    setStats({ totalUsers: totalUsers || 0, pending: pending || 0 })
  }

  const timeAgo = (dateString) => {
    const diff = Date.now() - new Date(dateString).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  return (
    <>
      <div className="hidden xl:block fixed left-6 top-24 w-56 z-0">
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-5">
          <p className="text-white/40 text-xs uppercase tracking-wide mb-3">Overview</p>

          {error && (
            <p className="text-red-300 text-xs">Couldn't load: {error}</p>
          )}

          {!error && variant === 'user' && stats && (
            <>
              <div className="mb-4">
                <p className="text-3xl font-bold text-white">{stats.total}</p>
                <p className="text-white/50 text-xs">Total documents</p>
              </div>
              <p className="text-white/40 text-xs uppercase tracking-wide mb-2">Recent</p>
              <ul className="space-y-2">
                {stats.recent.length === 0 && (
                  <li className="text-white/40 text-xs">No recent uploads</li>
                )}
                {stats.recent.map((f, i) => (
                  <li key={i} className="text-white/70 text-xs">
                    <p className="truncate">{f.file_name}</p>
                    <p className="text-white/40">{timeAgo(f.created_at)}</p>
                  </li>
                ))}
              </ul>
            </>
          )}

          {!error && variant === 'admin' && stats && (
            <>
              <div className="mb-4">
                <p className="text-3xl font-bold text-white">{stats.totalUsers}</p>
                <p className="text-white/50 text-xs">Total users</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-white">{stats.pending}</p>
                <p className="text-white/50 text-xs">Pending approval</p>
              </div>
            </>
          )}

          {!error && !stats && <p className="text-white/40 text-xs">Loading...</p>}
        </div>
      </div>

      <div className="hidden xl:flex fixed right-6 top-24 bottom-6 w-48 flex-col z-0">
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-4 flex-1 flex flex-col items-center justify-center text-center gap-3">
          <p className="text-white/40 text-xs uppercase tracking-wide">Advertisement</p>
          <div className="w-full aspect-[3/4] rounded-xl bg-gradient-to-br from-indigo-500/30 to-pink-500/30 border border-white/10 flex items-center justify-center">
            <p className="text-white/60 text-sm px-3">Your ad could be here</p>
          </div>
        </div>
      </div>
    </>
  )
}