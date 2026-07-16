'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Send, Bot } from 'lucide-react'

export default function AssistantPage() {
  const [user, setUser] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    checkUser()
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
    setUser(user)
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage = { role: 'user', content: input.trim() }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${data.error}` }])
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
      }
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Could not reach the assistant.' }])
    }

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
      <div className="h-screen flex items-center justify-center" style={bgStyle}>
        <p className="text-white text-lg">Loading...</p>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col" style={bgStyle}>
      <div className="shrink-0 flex items-center gap-3 px-4 md:px-6 py-4 border-b border-white/10 bg-white/10 backdrop-blur-lg">
        <button
          onClick={() => { window.location.href = '/documents' }}
          className="w-10 h-10 flex items-center justify-center rounded-xl text-white bg-white/10 border border-white/20 hover:bg-white/20 transition-all"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center text-white shrink-0">
          <Bot size={18} />
        </div>
        <h1 className="text-xl font-bold text-white">Assistant</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 max-w-3xl mx-auto w-full space-y-2">
        {messages.length === 0 ? (
          <p className="text-white/50 text-sm text-center mt-8">Ask me anything 👋</p>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-indigo-500 to-pink-500 text-white'
                    : 'bg-white/20 text-white'
                }`}
              >
                <p className="break-words whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="max-w-[75%] px-4 py-2 rounded-2xl text-sm bg-white/20 text-white">
              Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSend}
        className="shrink-0 flex gap-2 px-4 py-4 border-t border-white/10 bg-white/10 backdrop-blur-lg max-w-3xl mx-auto w-full"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message the assistant..."
          className="flex-1 px-4 py-3 rounded-full bg-white/90 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="w-12 h-12 flex items-center justify-center rounded-full text-white bg-gradient-to-r from-indigo-500 to-pink-500 hover:from-indigo-600 hover:to-pink-600 transition-all disabled:opacity-40 shrink-0"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  )
}