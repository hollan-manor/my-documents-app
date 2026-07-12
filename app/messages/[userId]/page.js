'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, Send } from 'lucide-react'

export default function ChatPage() {
  const params = useParams()
  const router = useRouter()
  const otherUserId = params.userId

  const [user, setUser] = useState(null)
  const [otherUser, setOtherUser] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef(null)
  const channelRef = useRef(null)

  useEffect(() => {
    loadChat()
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [otherUserId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadChat = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = '/login'
      return
    }
    setUser(user)

    const { data: otherProfile } = await supabase
      .from('profiles')
      .select('email, username')
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
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          console.log('Realtime message received:', payload.new)
          const msg = payload.new
          const isRelevant =
            (msg.sender_id === myId && msg.recipient_id === otherUserId) ||
            (msg.sender_id === otherUserId && msg.recipient_id === myId)

          if (isRelevant) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev
              return [...prev, msg]
            })
            if (msg.sender_id === otherUserId) {
              supabase.from('messages').update({ read: true }).eq('id', msg.id)
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status)
      })

    channelRef.current = channel
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if (!newMessage.trim() || sending || !user) return

    setSending(true)
    const content = newMessage.trim()
    setNewMessage('')

    const { data, error } = await supabase
      .from('messages')
      .insert([
        {
          sender_id: user.id,
          recipient_id: otherUserId,
          content,
        },
      ])
      .select()
      .single()

    if (error) {
      console.error('Send error:', error.message)
      alert('Could not send message: ' + error.message)
      setSending(false)
      return
    }

    setMessages((prev) => [...prev, data])
    setSending(false)
  }

  if (!user || !otherUser) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-white/60 text-sm">Loading...</p>
      </div>
    )
  }

  const headerName = otherUser.username ? `@${otherUser.username}` : otherUser.email

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-4 border-b border-white/10 bg-white/10 backdrop-blur-lg shrink-0">
        <button
          onClick={() => router.push('/messages')}
          className="w-9 h-9 flex items-center justify-center rounded-full text-white hover:bg-white/10 transition-all md:hidden"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center text-white font-semibold shrink-0">
          {headerName.replace('@', '').charAt(0).toUpperCase()}
        </div>
        <h1 className="text-white font-semibold truncate">{headerName}</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {messages.length === 0 ? (
          <p className="text-white/50 text-sm text-center mt-8">
            Say hello 👋 — no messages yet.
          </p>
        ) : (
          messages.map((msg) => {
            const isMine = msg.sender_id === user.id
            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
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

      <form onSubmit={handleSend} className="sticky bottom-0 z-10 flex gap-2 px-4 py-4 border-t border-white/10 bg-white/10 backdrop-blur-lg shrink-0">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Message..."
          className="flex-1 px-4 py-3 rounded-full bg-white/90 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || sending}
          className="w-12 h-12 flex items-center justify-center rounded-full text-white bg-gradient-to-r from-indigo-500 to-pink-500 hover:from-indigo-600 hover:to-pink-600 transition-all disabled:opacity-40 shrink-0"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  )
}