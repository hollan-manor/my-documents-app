'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Search, X } from 'lucide-react'

export default function MessagesPage() {
  const [user, setUser] = useState(null)
  const [myUsername, setMyUsername] = useState(null)
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const [usernameModalOpen, setUsernameModalOpen] = useState(false)
  const [usernameInput, setUsernameInput] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [savingUsername, setSavingUsername] = useState(false)

  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = '/login'
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('approved, username')
      .eq('id', user.id)
      .single()

    if (!profile || !profile.approved) {
      await supabase.auth.signOut()
      window.location.href = '/login'
      return
    }

    setUser(user)
    setMyUsername(profile.username)
    loadContacts(user.id)
  }

  const loadContacts = async (myId) => {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, email, username')
      .eq('approved', true)
      .neq('id', myId)

    if (error) {
      console.error('Failed to load contacts:', error.message)
      setLoading(false)
      return
    }

    const withPreviews = await Promise.all(
      (profiles || []).map(async (contact) => {
        const { data: lastMsg } = await supabase
          .from('messages')
          .select('content, created_at, sender_id')
          .or(`and(sender_id.eq.${myId},recipient_id.eq.${contact.id}),and(sender_id.eq.${contact.id},recipient_id.eq.${myId})`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        const { count: unreadCount } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('sender_id', contact.id)
          .eq('recipient_id', myId)
          .eq('read', false)

        return {
          ...contact,
          lastMessage: lastMsg?.content || null,
          lastMessageAt: lastMsg?.created_at || null,
          unreadCount: unreadCount || 0,
        }
      })
    )

    withPreviews.sort((a, b) => {
      if (!a.lastMessageAt) return 1
      if (!b.lastMessageAt) return -1
      return new Date(b.lastMessageAt) - new Date(a.lastMessageAt)
    })

    setContacts(withPreviews)
    setLoading(false)
  }

  const handleSetUsername = async () => {
    if (!usernameInput.trim()) return
    setSavingUsername(true)
    setUsernameError('')

    const { data: result, error } = await supabase.rpc('set_username', {
      new_username: usernameInput,
    })

    setSavingUsername(false)

    if (error || !result || !result.success) {
      setUsernameError(result?.error || error?.message || 'Could not set username')
      return
    }

    setMyUsername(result.username)
    setUsernameModalOpen(false)
    setUsernameInput('')
  }

  const filteredContacts = contacts.filter((c) => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return true
    return (
      c.email.toLowerCase().includes(q) ||
      (c.username && c.username.toLowerCase().includes(q))
    )
  })

  const bgStyle = {
    backgroundImage: 'var(--bg-image)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={bgStyle}>
        <p className="text-white text-lg">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-4 py-8" style={bgStyle}>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => { window.location.href = '/documents' }}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-white bg-white/10 border border-white/20 hover:bg-white/20 transition-all"
            >
              <ArrowLeft size={18} />
            </button>
            <h1 className="text-3xl font-bold text-white">Messages</h1>
          </div>

          <button
            onClick={() => setUsernameModalOpen(true)}
            className="px-3 py-2 rounded-xl text-sm font-medium text-white bg-white/10 border border-white/20 hover:bg-white/20 transition-all"
          >
            {myUsername ? `@${myUsername}` : 'Set username'}
          </button>
        </div>

        <div className="relative mb-4">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search by username or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/90 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>

        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-6">
          {loading ? (
            <p className="text-white/70">Loading contacts...</p>
          ) : filteredContacts.length === 0 ? (
            <p className="text-white/70">
              {searchQuery ? 'No matching users.' : 'No other users to message yet.'}
            </p>
          ) : (
            <ul className="space-y-2">
              {filteredContacts.map((contact) => (
                <li key={contact.id}>
                  <button
                    onClick={() => { window.location.href = `/messages/${contact.id}` }}
                    className="w-full flex items-center gap-3 bg-white/10 hover:bg-white/20 rounded-xl px-4 py-3 transition-all text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 flex items-center justify-center text-white font-semibold shrink-0">
                      {(contact.username || contact.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-white truncate">
                        {contact.username ? `@${contact.username}` : contact.email}
                      </p>
                      <p className="text-white/50 text-xs truncate">
                        {contact.lastMessage || 'No messages yet'}
                      </p>
                    </div>
                    {contact.unreadCount > 0 && (
                      <span className="shrink-0 min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold">
                        {contact.unreadCount}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {usernameModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center px-4 z-50"
          onClick={() => !savingUsername && setUsernameModalOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-white mb-1">Set Username</h2>
            <p className="text-white/70 text-sm mb-6">
              Lowercase letters, numbers, underscores. Min 3 characters.
            </p>

            <input
              type="text"
              placeholder="username"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/90 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-4"
              disabled={savingUsername}
            />

            {usernameError && (
              <p className="text-red-300 text-sm bg-red-900/30 rounded-lg px-3 py-2 mb-4">
                {usernameError}
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setUsernameModalOpen(false)}
                disabled={savingUsername}
                className="flex-1 py-3 rounded-xl font-medium text-white bg-white/10 border border-white/20 hover:bg-white/20 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSetUsername}
                disabled={!usernameInput.trim() || savingUsername}
                className="flex-1 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-500 to-pink-500 hover:from-indigo-600 hover:to-pink-600 transition-all disabled:opacity-40"
              >
                {savingUsername ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}