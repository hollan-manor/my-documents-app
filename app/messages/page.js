'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { ArrowLeft, MessageCircle } from 'lucide-react'

export default function MessagesPage() {
  const [user, setUser] = useState(null)
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(true)

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
      .select('approved')
      .eq('id', user.id)
      .single()

    if (!profile || !profile.approved) {
      await supabase.auth.signOut()
      window.location.href = '/login'
      return
    }

    setUser(user)
    loadContacts(user.id)
  }

  const loadContacts = async (myId) => {
    // Everyone else who's approved — potential people to message
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('approved', true)
      .neq('id', myId)

    if (!profiles) {
      setLoading(false)
      return
    }

    // For each contact, get their most recent message + unread count
    const withPreviews = await Promise.all(
      profiles.map(async (contact) => {
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
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => { window.location.href = '/documents' }}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-white bg-white/10 border border-white/20 hover:bg-white/20 transition-all"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-3xl font-bold text-white">Messages</h1>
        </div>

        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-6">
          {loading ? (
            <p className="text-white/70">Loading contacts...</p>
          ) : contacts.length === 0 ? (
            <p className="text-white/70">No other users to message yet.</p>
          ) : (
            <ul className="space-y-2">
              {contacts.map((contact) => (
                <li key={contact.id}>
                  <button
                    onClick={() => { window.location.href = `/messages/${contact.id}` }}
                    className="w-full flex items-center gap-3 bg-white/10 hover:bg-white/20 rounded-xl px-4 py-3 transition-all text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-pink-500 flex items-center justify-center text-white font-semibold shrink-0">
                      {contact.email.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-white truncate">{contact.email}</p>
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
    </div>
  )
}