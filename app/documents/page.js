'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

export default function DocumentsPage() {
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [user, setUser] = useState(null)
  const router = useRouter()

  // Check login status and load files when page opens
  useEffect(() => {
    checkUser()
  }, [])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
    } else {
      setUser(user)
      loadFiles()
    }
  }

  const loadFiles = async () => {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error) setFiles(data)
  }

  const handleUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    setUploading(true)

    // Create a unique path for the file in storage
    const filePath = `${Date.now()}_${file.name}`

    // Upload the actual file to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file)

    if (uploadError) {
      alert('Upload failed: ' + uploadError.message)
      setUploading(false)
      return
    }

    // Save a record of it in the database table
    const { data: { user } } = await supabase.auth.getUser()
    const { error: dbError } = await supabase
      .from('documents')
      .insert([
        {
          file_name: file.name,
          file_path: filePath,
          uploaded_by: user.id,
        },
      ])

    if (dbError) {
      alert('Saving record failed: ' + dbError.message)
    } else {
      loadFiles() // refresh the list
    }

    setUploading(false)
  }

  const handleDownload = async (filePath, fileName) => {
    const { data, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(filePath, 60) // link valid for 60 seconds

    if (error) {
      alert('Could not get download link: ' + error.message)
      return
    }

    const link = document.createElement('a')
    link.href = data.signedUrl
    link.download = fileName
    link.click()
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!user) return <p style={{ padding: '20px' }}>Loading...</p>

  return (
    <div style={{ maxWidth: '600px', margin: '50px auto', padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>My Documents</h1>
        <button onClick={handleLogout} style={{ padding: '6px 12px' }}>
          Log Out
        </button>
      </div>

      <div style={{ margin: '20px 0' }}>
        <input type="file" onChange={handleUpload} disabled={uploading} />
        {uploading && <p>Uploading...</p>}
      </div>

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {files.map((file) => (
          <li
            key={file.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '10px',
              borderBottom: '1px solid #ddd',
            }}
          >
            <span>{file.file_name}</span>
            <button onClick={() => handleDownload(file.file_path, file.file_name)}>
              Download
            </button>
          </li>
        ))}
      </ul>

      {files.now === 0 && <p>No documents yet.</p>}
    </div>
  )
}