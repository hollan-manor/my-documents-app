'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Send, Bot, Paperclip, Mic, Volume2, VolumeX, X } from 'lucide-react'

export default function AssistantPage() {
  const [user, setUser] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [attachedFile, setAttachedFile] = useState(null)
  const [listening, setListening] = useState(false)
  const [voiceReplyEnabled, setVoiceReplyEnabled] = useState(false)

  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const recognitionRef = useRef(null)

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

  const handleFileAttach = () => {
    fileInputRef.current.click()
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (file.type === 'text/plain') {
      const reader = new FileReader()
      reader.onload = () => {
        setAttachedFile({ name: file.name, content: reader.result, readable: true })
      }
      reader.readAsText(file)
    } else {
      // We can't actually read this file's content with a text-only model —
      // just let the person know it's attached in name only
      setAttachedFile({ name: file.name, content: null, readable: false })
    }
    e.target.value = ''
  }

  const removeAttachment = () => setAttachedFile(null)

  const handleMicClick = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Voice input isn\'t supported in this browser. Try Chrome or Edge.')
      return
    }

    if (listening) {
      recognitionRef.current?.stop()
      return
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => setListening(true)
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      setInput((prev) => (prev ? prev + ' ' + transcript : transcript))
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  const speak = (text) => {
    if (!voiceReplyEnabled) return
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    window.speechSynthesis.speak(utterance)
  }

  const handleSend = async (e) => {
    e.preventDefault()
    if ((!input.trim() && !attachedFile) || loading) return

    let content = input.trim()

    if (attachedFile) {
      if (attachedFile.readable) {
        content += `\n\n[Attached file: ${attachedFile.name}]\n${attachedFile.content}`
      } else {
        content += `\n\n[Attached file: ${attachedFile.name} — content type not readable by this model]`
      }
    }

    const userMessage = { role: 'user', content }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setAttachedFile(null)
    setLoading(true)

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })

      const data = await res.json()

      if (!res.ok) {
        const errText = `Error: ${data.error}`
        setMessages((prev) => [...prev, { role: 'assistant', content: errText }])
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }])
        speak(data.reply)
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
      <div className="shrink-0 flex items-center justify-between px-4 md:px-6 py-4 border-b border-white/10 bg-white/10 backdrop-blur-lg">
        <div className="flex items-center gap-3">
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

        <button
          onClick={() => setVoiceReplyEnabled((v) => !v)}
          title={voiceReplyEnabled ? 'Voice replies on' : 'Voice replies off'}
          className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${
            voiceReplyEnabled
              ? 'bg-gradient-to-r from-indigo-500 to-pink-500 text-white'
              : 'bg-white/10 border border-white/20 text-white hover:bg-white/20'
          }`}
        >
          {voiceReplyEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
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

      {attachedFile && (
        <div className="max-w-3xl mx-auto w-full px-4">
          <div className="flex items-center justify-between bg-white/10 border border-white/20 rounded-xl px-4 py-2 mb-2">
            <span className="text-white text-sm truncate">📎 {attachedFile.name}</span>
            <button onClick={removeAttachment} className="text-white/60 hover:text-white shrink-0 ml-2">
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSend}
        className="shrink-0 flex gap-2 px-4 py-4 border-t border-white/10 bg-white/10 backdrop-blur-lg max-w-3xl mx-auto w-full"
      >
        <input ref={fileInputRef} type="file" onChange={handleFileChange} className="hidden" />
        <button
          type="button"
          onClick={handleFileAttach}
          className="w-12 h-12 flex items-center justify-center rounded-full text-white bg-white/10 border border-white/20 hover:bg-white/20 transition-all shrink-0"
        >
          <Paperclip size={18} />
        </button>

        <div className="relative flex-1 min-w-0">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message the assistant..."
            className="w-full pl-4 pr-12 py-3 rounded-full bg-white/90 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button
            type="button"
            onClick={handleMicClick}
            className={`absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full transition-all ${
              listening ? 'bg-red-600 text-white animate-pulse' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Mic size={16} />
          </button>
        </div>

        <button
          type="submit"
          disabled={(!input.trim() && !attachedFile) || loading}
          className="w-12 h-12 flex items-center justify-center rounded-full text-white bg-gradient-to-r from-indigo-500 to-pink-500 hover:from-indigo-600 hover:to-pink-600 transition-all disabled:opacity-40 shrink-0"
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  )
}