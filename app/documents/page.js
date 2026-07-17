'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { MoreVertical, Eye, Download, Trash2, ChevronDown, LogOut, Share2, Send, X, Inbox, Search, Info, MessageCircle, Bot } from 'lucide-react'
import SideDecor from '../components/SideDecor'

const CATEGORIES = ['Personal', 'Work', 'Finance', 'Education', 'Health', 'Legal', 'Audio', 'Video', 'Other']

function getFileKind(fileName) {
  const ext = fileName.split('.').pop().toLowerCase()
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image'
  if (['mp4', 'mov', 'webm', 'ogg', 'mkv'].includes(ext)) return 'video'
  if (['mp3', 'wav', 'm4a', 'aac', 'flac'].includes(ext)) return 'audio'
  return 'other'
}

export default function DocumentsPage() {
  const [files, setFiles] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [user, setUser] = useState(null)
  const [activeCategory, setActiveCategory] = useState('Personal')
  const [openMenuId, setOpenMenuId] = useState(null)
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false)
  const [hasUnread, setHasUnread] = useState(false)
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false)

  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  const [recipientEmail, setRecipientEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [sendSuccess, setSendSuccess] = useState('')

  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchMenuId, setSearchMenuId] = useState(null)

  const [previewFile, setPreviewFile] = useState(null)

  const fileInputRef = useRef(null)
  const router = useRouter()

  const [themeGuess] = useState(() => {
    if (typeof window === 'undefined') return false
    return sessionStorage.getItem('specialTheme') === 'true'
  })
  const [themeResolved, setThemeResolved] = useState(false)
  const isSpecialAdmin = themeResolved ? isAdmin : themeGuess

  const bgStyle = {
    backgroundImage: 'var(--bg-image)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundAttachment: 'fixed',
  }

  const titleColorClass = isSpecialAdmin ? 'text-[#E8C468]' : 'text-white'

  useEffect(() => {
    if (typeof window === 'undefined') return
    document.documentElement.style.setProperty(
      '--bg-image',
      isSpecialAdmin ? "url('/circuit-bg.svg')" : "url('/triangles-bg.svg')"
    )
  }, [isSpecialAdmin])

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (user) loadFiles()
  }, [activeCategory, user])

  useEffect(() => {
    const closeMenus = () => {
      setOpenMenuId(null)
      setCategoryMenuOpen(false)
      setSearchMenuId(null)
    }
    window.addEventListener('click', closeMenus)
    return () => window.removeEventListener('click', closeMenus)
  }, [])

  useEffect(() => {
    if (!searchOpen) return
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    const timeout = setTimeout(() => {
      runSearch()
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchQuery, searchOpen])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('approved, is_admin')
      .eq('id', user.id)
      .single()

    if (!profile || !profile.approved) {
      await supabase.auth.signOut()
      router.push('/login')
      return
    }

    setIsAdmin(profile.is_admin)
    setUser(user)
    setThemeResolved(true)
    sessionStorage.setItem('specialTheme', profile.is_admin.toString())
    loadUnreadStatus()
    loadUnreadMessages(user.id)
  }

  const loadUnreadStatus = async () => {
    const { count, error } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('category', 'Inbox')
      .eq('is_read', false)

    if (!error) setHasUnread((count || 0) > 0)
  }

  const loadUnreadMessages = async (userId) => {
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', userId)
      .eq('read', false)

    if (!error) setHasUnreadMessages((count || 0) > 0)
  }

  const loadFiles = async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('category', activeCategory)
      .order('created_at', { ascending: false })

    if (!error) setFiles(data)
  }

  const runSearch = async () => {
    setSearching(true)
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .neq('category', 'Inbox')
      .ilike('file_name', `%${searchQuery.trim()}%`)
      .order('created_at', { ascending: false })

    if (!error) setSearchResults(data)
    setSearching(false)
  }

  const closeSearch = () => {
    setSearchOpen(false)
    setSearchQuery('')
    setSearchResults([])
  }

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setUploading(true)

    const filePath = `${user.id}/${Date.now()}_${file.name}`

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file)

    if (uploadError) {
      alert('Upload failed: ' + uploadError.message)
      setUploading(false)
      return
    }

    const { error: dbError } = await supabase
      .from('documents')
      .insert([
        {
          file_name: file.name,
          file_path: filePath,
          uploaded_by: user.id,
          category: activeCategory,
          file_size: file.size,
        },
      ])

    if (dbError) {
      alert('Saving record failed: ' + dbError.message)
    } else {
      loadFiles()
    }

    setUploading(false)
    e.target.value = ''
  }

  const handleOpen = async (filePath, fileName) => {
    const kind = getFileKind(fileName)

    if (kind === 'video' || kind === 'audio') {
      const queue = files.filter((f) => {
        const k = getFileKind(f.file_name)
        return k === 'video' || k === 'audio'
      })
      const index = queue.findIndex((f) => f.file_path === filePath)
      await openQueueItem(queue, index)
      return
    }

    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 3600)

    if (error) {
      alert('Could not open file: ' + error.message)
      return
    }

    if (kind === 'image') {
      setPreviewFile({ url: data.signedUrl, kind, name: fileName })
    } else {
      window.open(data.signedUrl, '_blank')
    }
  }

  const openQueueItem = async (queue, index) => {
    if (index < 0 || index >= queue.length) return

    const item = queue[index]
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(item.file_path, 3600)

    if (error) {
      alert('Could not open file: ' + error.message)
      return
    }

    setPreviewFile({
      url: data.signedUrl,
      kind: getFileKind(item.file_name),
      name: item.file_name,
      queue,
      queueIndex: index,
    })
  }

  const playNext = () => {
    if (!previewFile?.queue) return
    openQueueItem(previewFile.queue, previewFile.queueIndex + 1)
  }

  const playPrevious = () => {
    if (!previewFile?.queue) return
    openQueueItem(previewFile.queue, previewFile.queueIndex - 1)
  }

   const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(filePath, 3600)

  if (error) {
    alert('Could not open file: ' + error.message)
    return
  }

  if (kind === 'image') {
    setPreviewFile({ url: data.signedUrl, kind, name: fileName })
  } else {
    window.open(data.signedUrl, '_blank')
  }
}

const openQueueItem = async (queue, index) => {
  if (index < 0 || index >= queue.length) return

  const item = queue[index]
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(item.file_path, 3600)

  if (error) {
    alert('Could not open file: ' + error.message)
    return
  }

  setPreviewFile({
    url: data.signedUrl,
    kind: getFileKind(item.file_name),
    name: item.file_name,
    queue,
    queueIndex: index,
  })
}

const playNext = () => {
  if (!previewFile?.queue) return
  openQueueItem(previewFile.queue, previewFile.queueIndex + 1)
}

const playPrevious = () => {
  if (!previewFile?.queue) return
  openQueueItem(previewFile.queue, previewFile.queueIndex - 1)
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

  const handleShowPath = (filePath) => {
    alert(`File path:\n${filePath}`)
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

    loadFiles()
    if (searchOpen) runSearch()
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const toggleSelect = (fileId) => {
    setSelectedIds((prev) =>
      prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]
    )
  }

  const exitSelectionMode = () => {
    setSelectionMode(false)
    setSelectedIds([])
  }

  const handleSend = async () => {
    if (!recipientEmail.includes('@')) return

    setSending(true)
    setSendError('')
    setSendSuccess('')

    for (const fileId of selectedIds) {
      const { data: result, error: fnError } = await supabase.rpc('share_document', {
        doc_id: fileId,
        recipient_email: recipientEmail,
      })

      if (fnError || !result || !result.success) {
        setSendError(result?.error || fnError?.message || 'Failed to share a file')
        setSending(false)
        return
      }

      const { data: fileData, error: downloadError } = await supabase.storage
        .from('documents')
        .download(result.source_path)

      if (downloadError) {
        setSendError('Could not read file to share: ' + downloadError.message)
        setSending(false)
        return
      }

      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(result.new_path, fileData)

      if (uploadError) {
        setSendError('Could not deliver file: ' + uploadError.message)
        setSending(false)
        return
      }
    }

    setSending(false)
    setSendSuccess(`Sent ${selectedIds.length} file(s) to ${recipientEmail}`)
    setSelectedIds([])
    setTimeout(() => {
      setSendDialogOpen(false)
      setSendSuccess('')
      setRecipientEmail('')
      exitSelectionMode()
    }, 1500)
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
      <SideDecor />

      <div className="shrink-0 flex items-center justify-between px-4 md:px-6 py-4 border-b border-white/10 bg-white/10 backdrop-blur-lg">
        <div className="flex items-center gap-2 md:gap-3">
          <button
           onClick={() => { window.location.href = '/assistant' }}
           title="Assistant"
           className="w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-xl text-white bg-white/10 border border-white/20 hover:bg-white/20 transition-all"
          >
           <Bot size={18} />
          </button>
          <button
            onClick={() => fileInputRef.current.click()}
            disabled={uploading}
            className="px-4 md:px-5 py-2.5 md:py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-500 to-pink-500 hover:from-indigo-600 hover:to-pink-600 transition-all shadow-lg disabled:opacity-60 text-sm md:text-base"
          >
            {uploading ? 'Uploading...' : '+ Upload'}
          </button>
          <input ref={fileInputRef} type="file" onChange={handleUpload} className="hidden" />
          <button
            onClick={() => { window.location.href = '/inbox' }}
            title="Inbox"
            className="relative w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-xl text-white bg-white/10 border border-white/20 hover:bg-white/20 transition-all"
          >
            <Inbox size={18} />
            {hasUnread && <span className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full bg-red-600 border-2 border-slate-900" />}
          </button>
          <button
            onClick={() => { window.location.href = '/messages' }}
            title="Messages"
            className="relative w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-xl text-white bg-white/10 border border-white/20 hover:bg-white/20 transition-all"
          >
            <MessageCircle size={18} />
            {hasUnreadMessages && <span className="absolute top-1.5 right-1.5 w-3 h-3 rounded-full bg-red-600 border-2 border-slate-900" />}
          </button>
            <button
            onClick={() => { window.location.href = '/assistant' }}
            title="Assistant"
            className="w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-xl text-white bg-white/10 border border-white/20 hover:bg-white/20 transition-all"
          >
            <Bot size={18} />
          </button>
          <button
            onClick={() => setSearchOpen(true)}
            title="Search"
            className="w-10 h-10 md:w-11 md:h-11 flex items-center justify-center rounded-xl text-white bg-white/10 border border-white/20 hover:bg-white/20 transition-all"
          >
            <Search size={18} />
          </button>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {isAdmin && (
            <button
              onClick={() => router.push('/admin')}
              className="px-3 md:px-4 py-2 rounded-xl font-medium text-white bg-white/10 border border-white/20 hover:bg-white/20 transition-all text-sm md:text-base"
            >
              Admin
            </button>
          )}
          <button
            onClick={handleLogout}
            className="hidden md:block px-4 py-2 rounded-xl font-medium text-white bg-red-600 hover:bg-red-700 transition-all"
          >
            Log Out
          </button>
        </div>
      </div>

      <div className="hidden md:flex shrink-0 flex-wrap gap-2 px-6 py-3 border-b border-white/10 bg-white/5 backdrop-blur-lg">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-xl font-medium transition-all ${
              activeCategory === cat
                ? 'bg-gradient-to-r from-indigo-500 to-pink-500 text-white shadow-lg'
                : 'bg-white/10 text-white border border-white/20 hover:bg-white/20'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="md:hidden shrink-0 relative z-30 px-4 py-3 border-b border-white/10 bg-white/5 backdrop-blur-lg">
        <button
          onClick={(e) => {
            e.stopPropagation()
            setCategoryMenuOpen(!categoryMenuOpen)
          }}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium text-white bg-gradient-to-r from-indigo-500 to-pink-500 shadow-lg"
        >
          <span>Categories: {activeCategory}</span>
          <ChevronDown size={18} className={`transition-transform ${categoryMenuOpen ? 'rotate-180' : ''}`} />
        </button>

        {categoryMenuOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute left-4 right-4 mt-2 z-[100] bg-slate-900 border border-white/20 rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto"
          >
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setActiveCategory(cat)
                  setCategoryMenuOpen(false)
                }}
                className={`w-full text-left px-4 py-3 text-sm transition-all ${
                  activeCategory === cat
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-6 py-6 pb-24 md:pb-6">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className={`text-2xl font-bold ${titleColorClass}`}>{activeCategory} Documents</h1>
              {selectionMode && (
                <button
                  onClick={exitSelectionMode}
                  className="text-white/70 hover:text-white text-sm flex items-center gap-1"
                >
                  <X size={16} /> Cancel ({selectedIds.length} selected)
                </button>
              )}
            </div>

            {files.length === 0 ? (
              <p className="text-white/70">No documents in this category yet.</p>
            ) : (
              <ul className="space-y-2">
                {files.map((file) => (
                  <li
                    key={file.id}
                    className="relative flex items-center justify-between gap-2 bg-white/10 rounded-xl px-4 py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {selectionMode && (
                        <button
                          onClick={() => toggleSelect(file.id)}
                          className={`shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${
                            selectedIds.includes(file.id)
                              ? 'bg-indigo-500 border-indigo-500'
                              : 'border-white/40'
                          }`}
                        >
                          {selectedIds.includes(file.id) && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                      )}
                      <span
                        className="text-white truncate min-w-0"
                        style={isSpecialAdmin ? { color: '#E8C468' } : undefined}
                      >
                        {file.file_name}
                      </span>
                    </div>

                    {!selectionMode && (
                      <>
                        <div className="hidden md:flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleOpen(file.file_path, file.file_name)}
                            title="Open"
                            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-all"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => handleShowPath(file.file_path)}
                            title="Show file path"
                            className="w-9 h-9 flex items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-700 text-white transition-all"
                          >
                            <Info size={16} />
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
                            className="md:hidden absolute right-4 top-14 z-10 w-44 bg-slate-900 border border-white/20 rounded-xl shadow-2xl overflow-hidden"
                          >
                            <button
                              onClick={() => { handleOpen(file.file_path, file.file_name); setOpenMenuId(null) }}
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
                            <button
                              onClick={() => { handleShowPath(file.file_path); setOpenMenuId(null) }}
                              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-white hover:bg-white/10 transition-all"
                            >
                              <Info size={16} /> Show file path
                            </button>
                            <button
                              onClick={() => { handleDelete(file.id, file.file_path, file.file_name); setOpenMenuId(null) }}
                              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-white/10 transition-all"
                            >
                              <Trash2 size={16} /> Delete
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {!selectionMode && (
        <button
          onClick={() => setSelectionMode(true)}
          title="Share files"
          className="fixed bottom-4 right-4 w-14 h-14 flex items-center justify-center rounded-full text-white bg-gradient-to-r from-indigo-500 to-pink-500 shadow-2xl hover:scale-105 transition-all z-30"
        >
          <Share2 size={22} />
        </button>
      )}

      {selectionMode && selectedIds.length > 0 && (
        <button
          onClick={() => setSendDialogOpen(true)}
          className="fixed bottom-4 right-4 flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-500 to-pink-500 shadow-2xl hover:scale-105 transition-all z-30"
        >
          <Send size={18} /> Send ({selectedIds.length})
        </button>
      )}

      <button
        onClick={handleLogout}
        className="md:hidden fixed bottom-4 left-4 flex items-center gap-2 px-4 py-3 rounded-xl font-medium text-white bg-red-600 hover:bg-red-700 shadow-lg transition-all z-30"
      >
        <LogOut size={18} />
        Log Out
      </button>

      {sendDialogOpen && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center px-4 z-50"
          onClick={() => !sending && setSendDialogOpen(false)}
        >
          <div
            className="w-full max-w-sm bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-white mb-1">Send Files</h2>
            <p className="text-white/70 text-sm mb-6">
              Sending {selectedIds.length} file(s)
            </p>

            <input
              type="email"
              placeholder="Recipient's email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/90 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-4"
              disabled={sending}
            />

            {sendError && (
              <p className="text-red-300 text-sm bg-red-900/30 rounded-lg px-3 py-2 mb-4">
                {sendError}
              </p>
            )}
            {sendSuccess && (
              <p className="text-green-300 text-sm bg-green-900/30 rounded-lg px-3 py-2 mb-4">
                {sendSuccess}
              </p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setSendDialogOpen(false)}
                disabled={sending}
                className="flex-1 py-3 rounded-xl font-medium text-white bg-white/10 border border-white/20 hover:bg-white/20 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={!recipientEmail.includes('@') || sending}
                className="flex-1 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-500 to-pink-500 hover:from-indigo-600 hover:to-pink-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}

      {searchOpen && (
        <div
          className="fixed inset-0 bg-black/60 flex items-start justify-center px-4 pt-20 z-50"
          onClick={closeSearch}
        >
          <div
            className="w-full max-w-lg bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-6 max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-4">
              <input
                autoFocus
                type="text"
                placeholder="Search files across all categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl bg-white/90 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <button
                onClick={closeSearch}
                className="w-11 h-11 flex items-center justify-center rounded-xl text-white bg-white/10 border border-white/20 hover:bg-white/20 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              {searching && <p className="text-white/70 text-sm">Searching...</p>}
              {!searching && searchQuery.trim() && searchResults.length === 0 && (
                <p className="text-white/70 text-sm">No files found.</p>
              )}
              {!searching && !searchQuery.trim() && (
                <p className="text-white/50 text-sm">Start typing to search your files.</p>
              )}

              <ul className="space-y-2">
                {searchResults.map((file) => (
                  <li
                    key={file.id}
                    className="relative flex items-center justify-between gap-2 bg-white/10 rounded-xl px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-white truncate">{file.file_name}</p>
                      <p className="text-white/50 text-xs">{file.category}</p>
                    </div>

                    <div className="hidden md:flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleOpen(file.file_path, file.file_name)}
                        title="Open"
                        className="w-9 h-9 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-all"
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => handleShowPath(file.file_path)}
                        title="Show file path"
                        className="w-9 h-9 flex items-center justify-center rounded-full bg-indigo-600 hover:bg-indigo-700 text-white transition-all"
                      >
                        <Info size={16} />
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
                        setSearchMenuId(searchMenuId === file.id ? null : file.id)
                      }}
                      className="md:hidden shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-all"
                    >
                      <MoreVertical size={18} />
                    </button>

                    {searchMenuId === file.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="md:hidden absolute right-4 top-14 z-10 w-44 bg-slate-900 border border-white/20 rounded-xl shadow-2xl overflow-hidden"
                      >
                        <button
                          onClick={() => { handleOpen(file.file_path, file.file_name); setSearchMenuId(null) }}
                          className="w-full flex items-center gap-2 px-4 py-3 text-sm text-white hover:bg-white/10 transition-all"
                        >
                          <Eye size={16} /> Open
                        </button>
                        <button
                          onClick={() => { handleDownload(file.file_path, file.file_name); setSearchMenuId(null) }}
                          className="w-full flex items-center gap-2 px-4 py-3 text-sm text-white hover:bg-white/10 transition-all"
                        >
                          <Download size={16} /> Download
                        </button>
                        <button
                          onClick={() => { handleShowPath(file.file_path); setSearchMenuId(null) }}
                          className="w-full flex items-center gap-2 px-4 py-3 text-sm text-white hover:bg-white/10 transition-all"
                        >
                          <Info size={16} /> Show file path
                        </button>
                        <button
                          onClick={() => { handleDelete(file.id, file.file_path, file.file_name); setSearchMenuId(null) }}
                          className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-white/10 transition-all"
                        >
                          <Trash2 size={16} /> Delete
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {previewFile && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center px-4 z-[200]"
          onClick={() => setPreviewFile(null)}
        >
          <div
            className="max-w-3xl w-full max-h-[85vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between mb-3">
              <p className="text-white truncate pr-4">
                {previewFile.name}
                {previewFile.queue && (
                  <span className="text-white/50 text-sm ml-2">
                    ({previewFile.queueIndex + 1}/{previewFile.queue.length})
                  </span>
                )}
              </p>
              <button
                onClick={() => setPreviewFile(null)}
                className="w-9 h-9 flex items-center justify-center rounded-full text-white bg-white/10 hover:bg-white/20 transition-all shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {previewFile.kind === 'image' && (
              <img
                src={previewFile.url}
                alt={previewFile.name}
                className="max-w-full max-h-[75vh] rounded-xl object-contain"
              />
            )}
            {previewFile.kind === 'video' && (
              <video
                key={previewFile.url}
                src={previewFile.url}
                controls
                autoPlay
                onEnded={playNext}
                className="max-w-full max-h-[75vh] rounded-xl w-full"
              />
            )}
            {previewFile.kind === 'audio' && (
              <audio
                key={previewFile.url}
                src={previewFile.url}
                controls
                autoPlay
                onEnded={playNext}
                className="w-full"
              />
            )}

            {previewFile.queue && previewFile.queue.length > 1 && (
              <div className="flex items-center gap-4 mt-4">
                <button
                  onClick={playPrevious}
                  disabled={previewFile.queueIndex === 0}
                  className="px-4 py-2 rounded-xl font-medium text-white bg-white/10 border border-white/20 hover:bg-white/20 transition-all disabled:opacity-30"
                >
                  ← Previous
                </button>
                <button
                  onClick={playNext}
                  disabled={previewFile.queueIndex === previewFile.queue.length - 1}
                  className="px-4 py-2 rounded-xl font-medium text-white bg-white/10 border border-white/20 hover:bg-white/20 transition-all disabled:opacity-30"
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        </div>
      )}