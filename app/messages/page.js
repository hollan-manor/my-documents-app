'use client'

import { SquarePen } from 'lucide-react'

export default function MessagesEmptyState() {
  return (
    <div className="hidden md:flex flex-1 flex-col items-center justify-center text-center p-8">
      <div className="w-20 h-20 rounded-full border-2 border-white/30 flex items-center justify-center mb-4">
        <SquarePen size={32} className="text-white/70" />
      </div>
      <h2 className="text-white text-xl font-semibold mb-1">Your Messages</h2>
      <p className="text-white/50 text-sm">Select a conversation from the list to start chatting.</p>
    </div>
  )
}