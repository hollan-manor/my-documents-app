'use client'

export default function SideDecor() {
  return (
    <>
      {/* Left: animated circuit decoration — desktop only */}
      <div
        className="hidden xl:block fixed left-6 top-24 bottom-6 w-48 rounded-2xl border border-white/10 overflow-hidden shadow-2xl z-0"
        style={{
          backgroundImage: "url('/circuit-bg.svg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />

      {/* Right: placeholder ad space — desktop only */}
      <div className="hidden xl:flex fixed right-6 top-24 bottom-6 w-48 flex-col z-0">
        <div className="bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-4 flex-1 flex flex-col items-center justify-center text-center gap-3">
          <p className="text-white/40 text-xs uppercase tracking-wide">Advertisement</p>
          <div className="w-full aspect-[3/4] rounded-xl bg-gradient-to-br from-indigo-500/30 to-pink-500/30 border border-white/10 flex items-center justify-center">
            <p className="text-white/60 text-sm px-3">Your ad could be here</p>
          </div>
        </div>
      </div>
    </>
  )
}