'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, Send } from 'lucide-react'

export default function ChatPage() {
  const params = useParams()
  const otherUserId = params.userId

  const [user, setUser] = useState(null)
  const [otherUser, setOtherUser] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)
  const channelRef = useRef(null)

  useEffect(() => {
    checkUser()
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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

    const { data: otherProfile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', otherUserId)
      .single()

    setOtherUser(otherProfile)

    await loadMessages(user.id)
    subscribeToMessages(user.id)
  }

  const loadMessages = async (myId) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${myId},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${myId})`)
      .order('created_at', { ascending: true })

    if (!error) {
      setMessages(data)

      // Mark any messages from them to me as read
      const unreadIds = data
        .filter((m) => m.sender_id === otherUserId && m.recipient_id === myId && !m.read)
        .map((m) => m.id)

      if (unreadIds.length > 0) {
        await supabase
          .from('messages')
          .update({ read: true })
          .in('id', unreadIds)
      }
    }
  }

  const subscribeToMessages = (myId) => {
    const channel = supabase
      .channel(`chat-${myId}-${otherUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const msg = payload.new
          const isRelevant =
            (msg.sender_id === myId && msg.recipient_id === otherUserId) ||
            (msg.sender_id === otherUserId && msg.recipient_id === myId)

          if (isRelevant) {
            setMessages((prev) => [...prev, msg])

            // If it's from them, mark it read immediately since we're viewing this chat
            if (msg.sender_id === otherUserId) {
              supabase.from('messages').update({ read: true }).eq('id', msg.id)
            }
          }
        }
      )
      .subscribe()

    channelRef.current = channel
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || sending) return

    setSending(true)
    const content = newMessage.trim()
    setNewMessage('')

    const { error } = await supabase.from('messages').insert([
      {
        sender_id: user.id,
        recipient_id: otherUserId,
        content,
      },
    ])

    if (error) {
      alert('Could not send message: ' + error.message)
    }

    setSending(false)
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
    <div className="min-h-screen px-4 py-8 flex flex-col" style={bgStyle}>
      <div className="max-w-2xl w-full mx-auto flex flex-col flex-1">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => { window.location.href = '/messages' }}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-white bg-white/10 border border-white/20 hover:bg-white/20 transition-all"
          >
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-xl font-bold text-white truncate">
            {otherUser?.email || 'Chat'}
          </h1>
        </div>

        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-4 flex-1 flex flex-col min-h-[60vh] max-h-[70vh]">
          <div className="flex-1 overflow-y-auto space-y-2 mb-4 pr-1">
            {messages.length === 0 ? (
              <p className="text-white/50 text-sm text-center mt-8">
                Say hello 👋 — no messages yet.
              </p>
            ) : (
              messages.map((msg) => {
                const isMine = msg.sender_id === user.id
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${
                        isMine
                          ? 'bg-gradient-to-r from-indigo-500 to-pink-500 text-white'
                          : 'bg-white/20 text-white'
                      }`}
                    >
                      <p className="break-words">{msg.content}</p>
                      <p className="text-[10px] opacity-60 mt-1">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-4 py-3 rounded-xl bg-white/90 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending}
              className="w-12 h-12 flex items-center justify-center rounded-xl text-white bg-gradient-to-r from-indigo-500 to-pink-500 hover:from-indigo-600 hover:to-pink-600 transition-all disabled:opacity-40 shrink-0"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}