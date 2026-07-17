'use client'

import { useState, useEffect } from 'react'

// Your actual ad photos
const SLIDES = ['/ads/Rotor1.jpg', '/ads/Rotor2.jpg', '/ads/Rotor3.jpg','/ads/Rotor4.jpg','/ads/Rotor5.jpg','/ads/Rotor6.jpg','/ads/Rotor7.jpg']

export default function SideDecor() {
  const [slideIndex, setSlideIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setSlideIndex((i) => (i + 1) % SLIDES.length)
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
            {SLIDES.map((src, i) => (
              <img
                key={src}
                src={src}
                alt={`Ad ${i + 1}`}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
                  i === slideIndex ? 'opacity-100' : 'opacity-0'
                }`}
              />
            ))}
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
              {SLIDES.map((_, i) => (
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