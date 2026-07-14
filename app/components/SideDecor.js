'use client'

import { useState, useEffect } from 'react'

// Placeholder slides — swap these for real photos later.
// To use real images: put files in /public/ads/ (e.g. ad1.jpg, ad2.jpg),
// then replace this array with: const SLIDES = ['/ads/ad1.jpg', '/ads/ad2.jpg', ...]
const PLACEHOLDER_SLIDES = [
  { color: 'from-indigo-500/40 to-pink-500/40', label: 'Photo 1' },
  { color: 'from-emerald-500/40 to-cyan-500/40', label: 'Photo 2' },
  { color: 'from-amber-500/40 to-red-500/40', label: 'Photo 3' },
]

export default function SideDecor() {
  const [slideIndex, setSlideIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setSlideIndex((i) => (i + 1) % PLACEHOLDER_SLIDES.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  return (
    <>
      <div className="hidden xl:flex fixed left-6 top-24 bottom-6 w-48 flex-col z-0">
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-4 flex-1 flex flex-col items-center justify-center text-center gap-3">
          <p className="text-white/40 text-xs uppercase tracking-wide">Other Products</p>
          <div className="w-full aspect-[3/4] rounded-xl bg-gradient-to-br from-indigo-500/30 to-pink-500/30 border border-white/10 flex items-center justify-center">
            <p className="text-white/60 text-sm px-3">by Azure AD</p>
          </div>
        </div>
      </div>

      <div className="hidden xl:flex fixed right-6 top-24 bottom-6 w-48 flex-col z-0">
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-4 flex-1 flex flex-col items-center justify-center text-center gap-3">
          <p className="text-white/40 text-xs uppercase tracking-wide">Advertisement</p>
          <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden border border-white/10">
            {PLACEHOLDER_SLIDES.map((slide, i) => (
              <div
                key={i}
                className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${slide.color} transition-opacity duration-700 ${
                  i === slideIndex ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <p className="text-white/70 text-sm px-3">{slide.label}</p>
              </div>
            ))}
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
              {PLACEHOLDER_SLIDES.map((_, i) => (
                <span
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    i === slideIndex ? 'bg-white' : 'bg-white/30'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}