'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Send, Bot } from 'lucide-react'

export default function AssistantPage() {
  const router = useRouter()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy])

  const send = async () => {
    const text = input.trim()
    if (!text || busy) return
    const next = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setErr('')
    setBusy(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      const r = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ messages: next }),
      })
      const raw = await r.text()
      let j
      try { j = JSON.parse(raw) } catch { throw new Error(`Server error ${r.status}. Check the terminal running npm run dev.`) }
      if (!r.ok) throw new Error(j.error || 'Something went wrong.')
      setMessages([...next, { role: 'assistant', content: j.reply }])
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="h-screen flex flex-col"
      style={{ backgroundImage: 'var(--bg-image)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}
    >
      <div className="shrink-0 flex items-center gap-3 px-4 md:px-6 py-4 border-b border-white/10 bg-white/10 backdrop-blur-lg">
        <button
          onClick={() => router.push('/documents')}
          className="w-10 h-10 flex items-center justify-center rounded-xl text-white bg-white/10 border border-white/20 hover:bg-white/20 transition-all"
        >
          <ArrowLeft size={18} />
        </button>
        <Bot size={22} className="text-white" />
        <h1 className="text-xl font-bold text-white">Assistant</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-3">
          {messages.length === 0 && (
            <p className="text-white/60 text-center mt-10">Ask me anything about using your documents.</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] px-4 py-3 rounded-2xl whitespace-pre-wrap text-white ${
                  m.role === 'user'
                    ? 'bg-gradient-to-r from-indigo-500 to-pink-500'
                    : 'bg-white/10 border border-white/20 backdrop-blur-lg'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {busy && <p className="text-white/60 text-sm">Thinking...</p>}
          {err && <p className="text-red-300 text-sm bg-red-900/30 rounded-lg px-3 py-2">{err}</p>}
          <div ref={endRef} />
        </div>
      </div>

      <div className="shrink-0 px-4 md:px-6 py-4 border-t border-white/10 bg-white/10 backdrop-blur-lg">
        <div className="max-w-3xl mx-auto flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="Type a message..."
            className="flex-1 px-4 py-3 rounded-xl bg-white/90 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            onClick={send}
            disabled={busy || !input.trim()}
            className="px-5 rounded-xl text-white bg-gradient-to-r from-indigo-500 to-pink-500 disabled:opacity-40"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}