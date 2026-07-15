'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { ArrowLeft, Send, Paperclip, FileText, Download, Check, CheckCheck } from 'lucide-react'

export default function ChatPage() {
  const params = useParams()
  const router = useRouter()
  const otherUserId = params.userId

  const [user, setUser] = useState(null)
  const [otherUser, setOtherUser] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [signedUrls, setSignedUrls] = useState({})

  const [consentModalOpen, setConsentModalOpen] = useState(false)
  const [pendingFile, setPendingFile] = useState(null)

  const messagesEndRef = useRef(null)
  const channelRef = useRef(null)
  const fileInputRef = useRef(null)

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

  useEffect(() => {
    messages.forEach((msg) => {
      if (msg.attachment_path && msg.attachment_type?.startsWith('image/') && !signedUrls[msg.attachment_path]) {
        fetchSignedUrl(msg.attachment_path)
      }
    })
  }, [messages])

  const fetchSignedUrl = async (path) => {
    const { data } = await supabase.storage.from('chat-attachments').createSignedUrl(path, 3600)
    if (data) {
      setSignedUrls((prev) => ({ ...prev, [path]: data.signedUrl }))
    }
  }

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
        await supabase.from('messages').update({ read: true }).in('id', unreadIds)
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
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new
          const isRelevant =
            (msg.sender_id === myId && msg.recipient_id === otherUserId) ||
            (msg.sender_id === otherUserId && msg.recipient_id === myId)

          if (isRelevant) {
            // This is what makes the tick flip to red instantly on the sender's screen
            setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, read: msg.read } : m)))
          }
        }
      )
      .subscribe()

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
      .insert([{ sender_id: user.id, recipient_id: otherUserId, content }])
      .select()
      .single()

    if (error) {
      alert('Could not send message: ' + error.message)
      setSending(false)
      return
    }

    setMessages((prev) => [...prev, data])
    setSending(false)
  }

  const handleAttachClick = () => {
    fileInputRef.current.click()
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const consented = localStorage.getItem('chatAttachmentConsent') === 'true'
    if (!consented) {
      setPendingFile(file)
      setConsentModalOpen(true)
    } else {
      uploadAndSendFile(file)
    }
    e.target.value = ''
  }

  const confirmConsent = () => {
    localStorage.setItem('chatAttachmentConsent', 'true')
    setConsentModalOpen(false)
    if (pendingFile) {
      uploadAndSendFile(pendingFile)
      setPendingFile(null)
    }
  }

  const uploadAndSendFile = async (file) => {
    setSending(true)

    const path = `${user.id}/${Date.now()}_${file.name}`

    const { error: uploadError } = await supabase.storage.from('chat-attachments').upload(path, file)

    if (uploadError) {
      alert('Upload failed: ' + uploadError.message)
      setSending(false)
      return
    }

    const { data, error } = await supabase
      .from('messages')
      .insert([
        {
          sender_id: user.id,
          recipient_id: otherUserId,
          content: '',
          attachment_path: path,
          attachment_name: file.name,
          attachment_type: file.type,
        },
      ])
      .select()
      .single()

    if (error) {
      alert('Could not send attachment: ' + error.message)
      setSending(false)
      return
    }

    setMessages((prev) => [...prev, data])
    setSending(false)
  }

  const handleDownloadAttachment = async (path, name) => {
    const { data, error } = await supabase.storage.from('chat-attachments').download(path)
    if (error) {
      alert('Could not download: ' + error.message)
      return
    }
    const url = URL.createObjectURL(data)
    const link = document.createElement('a')
    link.href = url
    link.download = name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
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
            const isImage = msg.attachment_type?.startsWith('image/')

            return (
              <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-2xl text-sm overflow-hidden ${
                    isMine
                      ? 'bg-gradient-to-r from-indigo-500 to-pink-500 text-white'
                      : 'bg-white/20 text-white'
                  }`}
                >
                  {msg.attachment_path && isImage && signedUrls[msg.attachment_path] && (
                    <img
                      src={signedUrls[msg.attachment_path]}
                      alt={msg.attachment_name}
                      className="max-w-full max-h-64 object-cover"
                    />
                  )}

                  {msg.attachment_path && !isImage && (
                    <button
                      onClick={() => handleDownloadAttachment(msg.attachment_path, msg.attachment_name)}
                      className="flex items-center gap-2 px-4 py-3 w-full hover:bg-white/10 transition-all"
                    >
                      <FileText size={18} className="shrink-0" />
                      <span className="truncate text-left flex-1">{msg.attachment_name}</span>
                      <Download size={16} className="shrink-0" />
                    </button>
                  )}

                  {msg.content && (
                    <div className="px-4 py-2">
                      <p className="break-words">{msg.content}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-1 px-4 pb-2">
                    <p className="text-[10px] opacity-60">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {isMine && (
                      msg.read ? (
                        <CheckCheck size={14} className="text-red-500" />
                      ) : (
                        <CheckCheck size={14} className="opacity-60" />
                      )
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="sticky bottom-0 z-10 flex gap-2 px-4 py-4 border-t border-white/10 bg-white/10 backdrop-blur-lg shrink-0">
        <input ref={fileInputRef} type="file" onChange={handleFileChange} className="hidden" />
        <button
          type="button"
          onClick={handleAttachClick}
          disabled={sending}
          className="w-12 h-12 flex items-center justify-center rounded-full text-white bg-white/10 border border-white/20 hover:bg-white/20 transition-all shrink-0 disabled:opacity-40"
        >
          <Paperclip size={18} />
        </button>
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

      {consentModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center px-4 z-50">
          <div className="w-full max-w-sm bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-8">
            <h2 className="text-xl font-bold text-white mb-2">Share Files in Chat</h2>
            <p className="text-white/70 text-sm mb-6">
              Files you send here will be visible to the person you're chatting with. This notice only appears once.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => { setConsentModalOpen(false); setPendingFile(null) }}
                className="flex-1 py-3 rounded-xl font-medium text-white bg-white/10 border border-white/20 hover:bg-white/20 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmConsent}
                className="flex-1 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-500 to-pink-500 hover:from-indigo-600 hover:to-pink-600 transition-all"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}