'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { Download, Trash2 } from 'lucide-react'

const CATEGORIES = ['Personal', 'Work', 'Finance', 'Education', 'Health', 'Legal', 'Audio', 'Video', 'Other']

export default function DocumentsPage() {
  const [files, setFiles] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [user, setUser] = useState(null)
  const [activeCategory, setActiveCategory] = useState('Personal')
  const fileInputRef = useRef(null)
  const router = useRouter()

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (user) loadFiles()
  }, [activeCategory, user])

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
    <div className="min-h-screen px-4 py-8" style={bgStyle}>
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
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-xl font-medium text-white bg-white/10 border border-white/20 backdrop-blur hover:bg-white/20 transition-all"
            >
              Log Out
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
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

        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-6">
          <h1 className="text-2xl font-bold text-white mb-4">{activeCategory} Documents</h1>

          {files.length === 0 ? (
            <p className="text-white/70">No documents in this category yet.</p>
          ) : (
            <ul className="space-y-2">
              {files.map((file) => (
                <li
                  key={file.id}
                  className="flex items-center justify-between bg-white/10 rounded-xl px-4 py-3"
                >
                  <span className="text-white truncate">{file.file_name}</span>
                  <div className="flex items-center gap-2">
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
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}