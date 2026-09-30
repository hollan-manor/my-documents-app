import { NextResponse } from 'next/server'
import { chat } from '../../lib/llm'
import { getUser } from '../../lib/quiz-server'

export const maxDuration = 60

const SYSTEM =
  'You are the assistant inside E-Docs Access, a document storage app with categories ' +
  '(Personal, Work, Finance, Education, Health, Legal, Audio, Video, Other), an inbox for shared files, and messaging. ' +
  'Answer clearly and briefly. If you do not know something about the user\'s own files, say so instead of guessing.'

export async function POST(req) {
  const user = await getUser(req)
  if (!user) return NextResponse.json({ error: 'Please log in again.' }, { status: 401 })

  try {
    const { messages } = await req.json()
    const history = (Array.isArray(messages) ? messages : [])
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-20)
    if (history.length === 0) return NextResponse.json({ error: 'Empty message.' }, { status: 400 })

    const { text } = await chat([{ role: 'system', content: SYSTEM }, ...history], {
      maxTokens: 1024,
      temperature: 0.6,
      timeoutMs: 55000,
    })
    return NextResponse.json({ reply: text || 'No reply came back. Try again.' })
  } catch (e) {
    console.error('[assistant] failed:', e)
    return NextResponse.json({ error: e.message || 'Assistant failed.' }, { status: 500 })
  }
}