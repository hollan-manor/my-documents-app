'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { MoreVertical, Eye, Download, Trash2, ChevronDown, LogOut } from 'lucide-react'

const CATEGORIES = ['Personal', 'Work', 'Finance', 'Education', 'Health', 'Legal', 'Audio', 'Video', 'Other']

export default function DocumentsPage() {
  const [files, setFiles] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [user, setUser] = useState(null)
  const [activeCategory, setActiveCategory] = useState('Personal')
  const [openMenuId, setOpenMenuId] = useState(null)
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false)
  const fileInputRef = useRef(null)
  const router = useRouter()

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
    }
    window.addEventListener('click', closeMenus)
    return () => window.removeEventListener('click', closeMenus)
  }, [])

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
  }

  const loadFiles = async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('category', activeCategory)
      .order('created_at', { ascending: false })

    if (!error) setFiles(data)
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

    loadFiles()
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const bgStyle = {
    backgroundImage: "url('/triangles-bg.svg')",
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
    <div className="min-h-screen px-4 py-8 pb-24 md:pb-8" style={bgStyle}>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => fileInputRef.current.click()}
              disabled={uploading}
              className="px-5 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-500 to-pink-500 hover:from-indigo-600 hover:to-pink-600 transition-all shadow-lg disabled:opacity-60"
            >
              {uploading ? 'Uploading...' : '+ Upload'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleUpload}
              className="hidden"
            />
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <button
                onClick={() => router.push('/admin')}
                className="px-4 py-2 rounded-xl font-medium text-white bg-white/10 border border-white/20 backdrop-blur hover:bg-white/20 transition-all"
              >
                Admin
              </button>
            )}
            {/* Desktop Log Out — stays top-right, now red */}
            <button
              onClick={handleLogout}
              className="hidden md:block px-4 py-2 rounded-xl font-medium text-white bg-red-600 hover:bg-red-700 transition-all"
            >
              Log Out
            </button>
          </div>
        </div>

        {/* Desktop: full category row */}
        <div className="hidden md:flex flex-wrap gap-2 mb-6">
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

        {/* Mobile: single Categories dropdown */}
        <div className="md:hidden relative mb-6">
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
              className="absolute left-0 right-0 mt-2 z-20 bg-slate-900 border border-white/20 rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto"
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

        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-6">
          <h1 className="text-2xl font-bold text-white mb-4">{activeCategory} Documents</h1>

          {files.length === 0 ? (
            <p className="text-white/70">No documents in this category yet.</p>
          ) : (
            <ul className="space-y-2">
              {files.map((file) => (
                <li
                  key={file.id}
                  className="relative flex items-center justify-between gap-2 bg-white/10 rounded-xl px-4 py-3"
                >
                  <span className="text-white truncate min-w-0">{file.file_name}</span>

                  {/* Desktop: icon buttons, always visible */}
                  <div className="hidden md:flex items-center gap-2 shrink-0">
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

                  {/* Mobile: three-dot menu */}
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
                      className="md:hidden absolute right-4 top-14 z-10 w-40 bg-slate-900 border border-white/20 rounded-xl shadow-2xl overflow-hidden"
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
                      <button
                        onClick={() => { handleDelete(file.id, file.file_path, file.file_name); setOpenMenuId(null) }}
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-white/10 transition-all"
                      >
                        <Trash2 size={16} /> Delete
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Mobile: fixed Log Out button, bottom-left, red */}
      <button
        onClick={handleLogout}
        className="md:hidden fixed bottom-4 left-4 flex items-center gap-2 px-4 py-3 rounded-xl font-medium text-white bg-red-600 hover:bg-red-700 shadow-lg transition-all z-30"
      >
        <LogOut size={18} />
        Log Out
      </button>
    </div>
  )
}