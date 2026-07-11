'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 KB'
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  const gb = mb / 1024
  return `${gb.toFixed(1)} GB`
}

export default function SideDecor({ user, variant = 'user' }) {
  const [categoryStats, setCategoryStats] = useState(null)
  const [adminStats, setAdminStats] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (variant === 'user' && user) loadUserStats()
    if (variant === 'admin') loadAdminStats()
  }, [user, variant])

  const loadUserStats = async () => {
    setLoading(true)
    setError('')
    try {
      const { data, error: fetchError } = await supabase
        .from('documents')
        .select('category, file_size')
        .neq('category', 'Inbox')

      if (fetchError) throw fetchError

      const grouped = {}
      let totalCount = 0
      let totalSize = 0

      for (const row of data || []) {
        const cat = row.category || 'Other'
        if (!grouped[cat]) grouped[cat] = { count: 0, size: 0 }
        grouped[cat].count += 1
        grouped[cat].size += row.file_size || 0
        totalCount += 1
        totalSize += row.file_size || 0
      }

      const sorted = Object.entries(grouped)
        .map(([category, stats]) => ({ category, ...stats }))
        .sort((a, b) => b.count - a.count)

      setCategoryStats({ byCategory: sorted, totalCount, totalSize })
    } catch (err) {
      console.error('SideDecor user stats error:', err.message)
      setError(err.message || 'Could not load stats')
    } finally {
      setLoading(false)
    }
  }

  const loadAdminStats = async () => {
    setLoading(true)
    setError('')
    try {
      const { count: totalUsers, error: usersError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })

      if (usersError) throw usersError

      const { count: pending, error: pendingError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('approved', false)

      if (pendingError) throw pendingError

      setAdminStats({ totalUsers: totalUsers || 0, pending: pending || 0 })
    } catch (err) {
      console.error('SideDecor admin stats error:', err.message)
      setError(err.message || 'Could not load stats')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="hidden xl:block fixed left-6 top-24 w-56 max-h-[calc(100vh-7rem)] overflow-y-auto z-0">
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-5">
          <p className="text-white/40 text-xs uppercase tracking-wide mb-3">Overview</p>

          {loading && <p className="text-white/40 text-xs">Loading...</p>}

          {!loading && error && (
            <p className="text-red-300 text-xs">Couldn't load: {error}</p>
          )}

          {!loading && !error && variant === 'user' && categoryStats && (
            <>
              <ul className="space-y-2 mb-4">
                {categoryStats.byCategory.length === 0 && (
                  <li className="text-white/40 text-xs">No documents yet</li>
                )}
                {categoryStats.byCategory.map((c) => (
                  <li key={c.category} className="flex items-center justify-between text-xs">
                    <span className="text-white/70">{c.category}</span>
                    <span className="text-white/40 text-right">
                      {c.count} · {formatBytes(c.size)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="border-t border-white/10 pt-3">
                <p className="text-2xl font-bold text-white">{categoryStats.totalCount}</p>
                <p className="text-white/50 text-xs">
                  Total documents · {formatBytes(categoryStats.totalSize)}
                </p>
              </div>
            </>
          )}

          {!loading && !error && variant === 'admin' && adminStats && (
            <>
              <div className="mb-4">
                <p className="text-3xl font-bold text-white">{adminStats.totalUsers}</p>
                <p className="text-white/50 text-xs">Total users</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-white">{adminStats.pending}</p>
                <p className="text-white/50 text-xs">Pending approval</p>
              </div>
            </>
          )}
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