'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

const SPECIAL_ADMIN_EMAIL = 'ivarnomasete@gmail.com'

export default function AdminPage() {
  const [pendingUsers, setPendingUsers] = useState([])
  const [allUsers, setAllUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userEmail, setUserEmail] = useState('')
  const router = useRouter()

  const isSpecialAdmin = userEmail === SPECIAL_ADMIN_EMAIL

  useEffect(() => {
    checkAdminAndLoad()
  }, [])

  const checkAdminAndLoad = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile || !profile.is_admin) {
      router.push('/documents')
      return
    }

    setIsAdmin(true)
    setUserEmail(user.email)
    await loadUsers()
    setLoading(false)
  }

  const loadUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setAllUsers(data)
      setPendingUsers(data.filter((u) => !u.approved))
    }
  }

  const handleApprove = async (userId) => {
    const { error } = await supabase
      .from('profiles')
      .update({ approved: true })
      .eq('id', userId)

    if (error) {
      alert('Could not approve: ' + error.message)
    } else {
      loadUsers()
    }
  }

  const handleRevoke = async (userId) => {
    const confirmed = window.confirm('Revoke this user\'s access?')
    if (!confirmed) return

    const { error } = await supabase
      .from('profiles')
      .update({ approved: false })
      .eq('id', userId)

    if (error) {
      alert('Could not revoke: ' + error.message)
    } else {
      loadUsers()
    }
  }

  const bgStyle = {
    backgroundImage: isSpecialAdmin ? "url('/circuit-bg.svg')" : "url('/triangles-bg.svg')",
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
  }

  const titleColorClass = isSpecialAdmin ? 'text-[#E8C468]' : 'text-white'

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={bgStyle}>
        <p className="text-white text-lg">Loading...</p>
      </div>
    )
  }

  if (!isAdmin) return null

  return (
    <div className="min-h-screen px-4 py-8" style={bgStyle}>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className={`text-3xl font-bold ${titleColorClass}`}>Admin</h1>
          <button
            onClick={() => router.push('/documents')}
            className="px-4 py-2 rounded-xl font-medium text-white bg-white/10 border border-white/20 backdrop-blur hover:bg-white/20 transition-all"
          >
            Back to Documents
          </button>
        </div>

        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-6 mb-6">
          <h2 className="text-xl font-bold text-white mb-4">
            Pending Approval ({pendingUsers.length})
          </h2>

          {pendingUsers.length === 0 ? (
            <p className="text-white/70">No pending requests.</p>
          ) : (
            <ul className="space-y-2">
              {pendingUsers.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center justify-between gap-3 bg-white/10 rounded-xl px-4 py-3"
                >
                  <span className="text-white truncate min-w-0">{u.email}</span>
                  <button
                    onClick={() => handleApprove(u.id)}
                    className="shrink-0 px-4 py-2 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-500 to-pink-500 hover:from-indigo-600 hover:to-pink-600 transition-all"
                  >
                    Approve
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-6">
          <h2 className="text-xl font-bold text-white mb-4">All Users</h2>
          <ul className="space-y-2">
            {allUsers.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between gap-3 bg-white/10 rounded-xl px-4 py-3"
              >
                <div className="min-w-0 flex items-center gap-2">
                  <span className="text-white truncate">{u.email}</span>
                  {u.is_admin && (
                    <span className="shrink-0 text-xs bg-indigo-500 text-white px-2 py-0.5 rounded-full">
                      Admin
                    </span>
                  )}
                </div>
                {u.approved ? (
                  !u.is_admin && (
                    <button
                      onClick={() => handleRevoke(u.id)}
                      className="shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-all"
                    >
                      Revoke
                    </button>
                  )
                ) : (
                  <span className="shrink-0 text-yellow-300 text-sm">Pending</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}