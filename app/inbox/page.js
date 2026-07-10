'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { MoreVertical, Eye, Download, Trash2, FolderInput, ArrowLeft } from 'lucide-react'

const CATEGORIES = ['Personal', 'Work', 'Finance', 'Education', 'Health', 'Legal', 'Audio', 'Video', 'Other']
const SPECIAL_ADMIN_EMAIL = 'ivarnomasete@gmail.com'

function formatSentDate(dateString) {
  const date = new Date(dateString)
  const day = date.getDate()
  const suffix =
    day % 10 === 1 && day !== 11 ? 'st' :
    day % 10 === 2 && day !== 12 ? 'nd' :
    day % 10 === 3 && day !== 13 ? 'rd' : 'th'

  const month = date.toLocaleString('en-US', { month: 'long' })
  const year = date.getFullYear().toString().slice(-2)
  let hours = date.getHours()
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'pm' : 'am'
  hours = hours % 12
  if (hours === 0) hours = 12

  return `${month} ${day}${suffix} ${hours}.${minutes}${ampm} '${year}`
}

function getMonthYear(dateString) {
  const date = new Date(dateString)
  const month = date.toLocaleString('en-US', { month: 'long' })
  const year = date.getFullYear().toString().slice(-2)
  return `${month} '${year}`
}

function getDayTime(dateString) {
  const date = new Date(dateString)
  const day = date.getDate()
  const suffix =
    day % 10 === 1 && day !== 11 ? 'st' :
    day % 10 === 2 && day !== 12 ? 'nd' :
    day % 10 === 3 && day !== 13 ? 'rd' : 'th'

  let hours = date.getHours()
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'pm' : 'am'
  hours = hours % 12
  if (hours === 0) hours = 12

  return `${day}${suffix} ${hours}.${minutes}${ampm}`
}

export default function InboxPage() {
  const [files, setFiles] = useState([])
  const [user, setUser] = useState(null)
  const [openMenuId, setOpenMenuId] = useState(null)
  const [moveMenuId, setMoveMenuId] = useState(null)

  const isSpecialAdmin = user?.email === SPECIAL_ADMIN_EMAIL

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    const closeMenus = () => {
      setOpenMenuId(null)
      setMoveMenuId(null)
    }
    window.addEventListener('click', closeMenus)
    return () => window.removeEventListener('click', closeMenus)
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
    loadInbox()
  }

  const loadInbox = async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('category', 'Inbox')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to load inbox:', error.message)
      return
    }

    setFiles(data)

    const unreadIds = data.filter((f) => !f.is_read).map((f) => f.id)
    if (unreadIds.length > 0) {
      const { error: markReadError } = await supabase
        .from('documents')
        .update({ is_read: true })
        .in('id', unreadIds)

      if (markReadError) {
        console.error('Failed to mark as read:', markReadError.message)
      }
    }
  }

  const handleOpen = async (filePath) => {
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 60)

    if (error) {
      alert('Could not open file: ' + error.message)
      return
    }

    window.open(data.signedUrl, '_blank')
  }

  const handleDownload = async (filePath, fileName) => {
    const { data, error } = await supabase.storage
      .from('documents')
      .download(filePath)

    if (error) {
      alert('Could not download file: ' + error.message)
      return
    }

    const url = URL.createObjectURL(data)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleDelete = async (fileId, filePath, fileName) => {
    const confirmed = window.confirm(`Delete "${fileName}"? This can't be undone.`)
    if (!confirmed) return

    const { error: storageError } = await supabase.storage
      .from('documents')
      .remove([filePath])

    if (storageError) {
      alert('Could not delete file: ' + storageError.message)
      return
    }

    const { error: dbError } = await supabase
      .from('documents')
      .delete()
      .eq('id', fileId)

    if (dbError) {
      alert('Could not delete record: ' + dbError.message)
      return
    }

    loadInbox()
  }

  const handleMove = async (fileId, category) => {
    const { error } = await supabase
      .from('documents')
      .update({ category })
      .eq('id', fileId)

    if (error) {
      alert('Could not move file: ' + error.message)
      return
    }

    loadInbox()
  }

  const bgStyle = {
    backgroundImage: isSpecialAdmin ? "url('/circuit-bg.svg')" : "url('/triangles-bg.svg')",
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
  }

  const titleColorClass = isSpecialAdmin ? 'text-[#E8C468]' : 'text-white'

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={bgStyle}>
        <p className="text-white text-lg">Loading...</p>
      </div>
    )
  }

  let lastMonthYear = null

  return (
    <div className="min-h-screen px-4 py-8" style={bgStyle}>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className={`text-3xl font-bold flex items-center gap-3 ${titleColorClass}`}>
            <button
              onClick={() => { window.location.href = '/documents' }}
              className="w-10 h-10 flex items-center justify-center rounded-xl text-white bg-white/10 border border-white/20 hover:bg-white/20 transition-all"
            >
              <ArrowLeft size={18} />
            </button>
            Inbox
          </h1>
        </div>

        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-6">
          {files.length === 0 ? (
            <p className="text-white/70">No shared files yet.</p>
          ) : (
            <ul className="space-y-2">
              {files.map((file) => {
                const monthYear = file.created_at ? getMonthYear(file.created_at) : null
                const showMonthHeader = monthYear !== lastMonthYear
                lastMonthYear = monthYear

                return (
                  <div key={file.id}>
                    {showMonthHeader && monthYear && (
                      <p className="md:hidden text-white/40 text-xs font-semibold uppercase tracking-wide pt-2 pb-1 first:pt-0">
                        {monthYear}
                      </p>
                    )}

                    <li
                      className="relative flex items-center justify-between gap-2 bg-white/10 rounded-xl px-4 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-white truncate"
                          style={isSpecialAdmin ? { color: '#E8C468' } : undefined}
                        >
                          {file.file_name}
                        </p>

                        {file.shared_from && (
                          <p className="hidden md:block text-white/50 text-xs truncate">
                            From: {file.shared_from} · <span className="text-green-400">{formatSentDate(file.created_at)}</span>
                          </p>
                        )}

                        {file.shared_from && (
                          <div className="md:hidden text-white/50 text-xs">
                            <p className="truncate">From: {file.shared_from}</p>
                            <p className="text-green-400">{getDayTime(file.created_at)}</p>
                          </div>
                        )}
                      </div>

                      <div className="hidden md:flex items-center gap-2 shrink-0">
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setMoveMenuId(moveMenuId === file.id ? null : file.id)
                            }}
                            title="Move to category"
                            className="w-9 h-9 flex items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-700 text-white transition-all"
                          >
                            <FolderInput size={16} />
                          </button>
                          {moveMenuId === file.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-11 z-10 w-40 bg-slate-900 border border-white/20 rounded-xl shadow-2xl overflow-hidden max-h-56 overflow-y-auto"
                            >
                              {CATEGORIES.map((cat) => (
                                <button
                                  key={cat}
                                  onClick={() => { handleMove(file.id, cat); setMoveMenuId(null) }}
                                  className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-all"
                                >
                                  {cat}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleOpen(file.file_path)}
                          title="Open"
                          className="w-9 h-9 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-all"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(file.id, file.file_path, file.file_name)}
                          title="Delete"
                          className="w-9 h-9 flex items-center justify-center rounded-full bg-red-600 hover:bg-red-700 text-white transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDownload(file.file_path, file.file_name)}
                          title="Download"
                          className="w-9 h-9 flex items-center justify-center rounded-full bg-green-600 hover:bg-green-700 text-white transition-all"
                        >
                          <Download size={16} />
                        </button>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenMenuId(openMenuId === file.id ? null : file.id)
                        }}
                        className="md:hidden shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-all"
                      >
                        <MoreVertical size={18} />
                      </button>

                      {openMenuId === file.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="md:hidden absolute right-4 top-14 z-10 w-44 bg-slate-900 border border-white/20 rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto"
                        >
                          <button
                            onClick={() => { handleOpen(file.file_path); setOpenMenuId(null) }}
                            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-white hover:bg-white/10 transition-all"
                          >
                            <Eye size={16} /> Open
                          </button>
                          <button
                            onClick={() => { handleDownload(file.file_path, file.file_name); setOpenMenuId(null) }}
                            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-white hover:bg-white/10 transition-all"
                          >
                            <Download size={16} /> Download
                          </button>
                          <div className="border-t border-white/10 my-1" />
                          <p className="px-4 py-1 text-xs text-white/50">Move to:</p>
                          {CATEGORIES.map((cat) => (
                            <button
                              key={cat}
                              onClick={() => { handleMove(file.id, cat); setOpenMenuId(null) }}
                              className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/10 transition-all"
                            >
                              {cat}
                            </button>
                          ))}
                          <div className="border-t border-white/10 my-1" />
                          <button
                            onClick={() => { handleDelete(file.id, file.file_path, file.file_name); setOpenMenuId(null) }}
                            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-white/10 transition-all"
                          >
                            <Trash2 size={16} /> Delete
                          </button>
                        </div>
                      )}
                    </li>
                  </div>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}