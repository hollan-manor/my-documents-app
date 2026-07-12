'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Search, X } from 'lucide-react'

function timeAgo(dateString) {
  const diff = Date.now() - new Date(dateString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  const weeks = Math.floor(days / 7)
  return `${weeks}w`
}

export default function MessagesLayout({ children }) {
  const [user, setUser] = useState(null)
  const [myUsername, setMyUsername] = useState(null)
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const [usernameModalOpen, setUsernameModalOpen] = useState(false)
  const [usernameInput, setUsernameInput] = useState('')
  const [usernameError, setUsernameError] = useState('')
  const [savingUsername, setSavingUsername] = useState(false)

  const pathname = usePathname()
  const router = useRouter()

  const isListRoute = pathname === '/messages'
  const activeUserId = pathname.startsWith('/messages/') ? pathname.split('/')[2] : null

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

    const channel = supabase
      .channel(`inbox-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new
          if (msg.sender_id === user.id || msg.recipient_id === user.id) {
            loadContacts(user.id)
          }
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
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
          lastMessageFromMe: lastMsg?.sender_id === myId,
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
    <div className="h-screen" style={bgStyle}>
      <div className="h-full flex overflow-hidden">
        <div
          className={`${isListRoute ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-[360px] shrink-0 bg-white/10 backdrop-blur-lg border-r border-white/10`}
        >
          <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <button
                onClick={() => { window.location.href = '/documents' }}
                className="w-9 h-9 flex items-center justify-center rounded-full text-white hover:bg-white/10 transition-all"
              >
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-lg font-bold text-white">
                {myUsername ? `@${myUsername}` : 'Messages'}
              </h1>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setSearchOpen((s) => !s)}
                className="w-9 h-9 flex items-center justify-center rounded-full text-white hover:bg-white/10 transition-all"
              >
                {searchOpen ? <X size={18} /> : <Search size={18} />}
              </button>
              <button
                onClick={() => setUsernameModalOpen(true)}
                className="px-2.5 py-1.5 rounded-full text-xs font-medium text-white bg-white/10 border border-white/20 hover:bg-white/20 transition-all"
              >
                {myUsername ? 'Edit' : 'Set username'}
              </button>
            </div>
          </div>

          {searchOpen && (
            <div className="px-4 py-3 border-b border-white/10">
              <div className="relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 rounded-full bg-white/90 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="text-white/70 p-6">Loading contacts...</p>
            ) : filteredContacts.length === 0 ? (
              <p className="text-white/70 p-6">
                {searchQuery ? 'No matching users.' : 'No other users to message yet.'}
              </p>
            ) : (
              filteredContacts.map((contact) => {
                const displayName = contact.username ? `@${contact.username}` : contact.email
                const isUnread = contact.unreadCount > 0
                const isActive = activeUserId === contact.id

                return (
                  <button
                    key={contact.id}
                    onClick={() => router.push(`/messages/${contact.id}`)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left border-b border-white/5 transition-all ${
                      isActive ? 'bg-white/15' : 'hover:bg-white/10'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center text-white font-semibold text-lg shrink-0">
                      {displayName.replace('@', '').charAt(0).toUpperCase()}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className={`truncate ${isUnread ? 'text-white font-semibold' : 'text-white/90'}`}>
                        {displayName}
                      </p>
                      <p className={`text-sm truncate ${isUnread ? 'text-white/80' : 'text-white/50'}`}>
                        {contact.lastMessage
                          ? `${contact.lastMessageFromMe ? 'You: ' : ''}${contact.lastMessage}`
                          : 'Start a conversation'}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {contact.lastMessageAt && (
                        <span className="text-white/40 text-xs">{timeAgo(contact.lastMessageAt)}</span>
                      )}
                      {isUnread && <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div className={`${isListRoute ? 'hidden' : 'flex'} md:flex flex-1 flex-col bg-white/5`}>
          {children}
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